#include "RecryptAsync.h"

#include "InputByteArrayStream.h"
#include "ObjectByteReaderWithPosition.h"
#include "ObjectByteWriterWithPosition.h"
#include "OutputStringBufferStream.h"
#include "Trace.h"

#include <openssl/crypto.h>

#include <algorithm>
#include <deque>
#include <mutex>
#include <string>
#include <vector>

using namespace muhammara::napi;
using namespace PDFHummus;

namespace {

// Chunk size for moving bytes between the JavaScript streams and memory.
const size_t kStreamChunkSize = 64 * 1024;

// PDFWriter is not audited for concurrent recrypts, so at most one runs in the
// process at a time, whichever thread or worker started it.
std::mutex &RecryptMutex() {
  static std::mutex mutex;
  return mutex;
}

struct RecryptJob {
  napi_env env = nullptr;
  napi_async_work work = nullptr;
  // The promise's resolve and reject functions. A napi_deferred is only freed
  // by settling it, which an ending worker thread no longer allows; references
  // can always be released.
  Reference resolve;
  Reference reject;
  // Set for the stream overload; receives the output once the work is done.
  Reference writeStream;

  bool usesStreams = false;
  std::string sourcePath;
  std::string targetPath;
  RecryptArguments options;

  std::vector<IOBasicTypes::Byte> input;
  OutputStringBufferStream output;

  EStatusCode status = eFailure;
};

// Jobs started from this thread that wait for the running one. Only one job
// per thread is on the libuv pool at a time, so queued jobs never hold pool
// threads that fs, dns and zlib need while they wait for the mutex.
struct JobQueue {
  std::deque<RecryptJob *> pending;
  bool running = false;
  // Environments on this thread that registered ReleasePendingJobs; Node
  // rejects registering the same hook twice.
  std::vector<napi_env> hooked;
};

JobQueue &ThreadQueue() {
  static thread_local JobQueue queue;
  return queue;
}

void DeleteJob(RecryptJob *job) {
  if (job->work)
    napi_delete_async_work(job->env, job->work);
  delete job;
}

// Settles the job's promise. Fails quietly once the environment can no longer
// run JavaScript.
void Settle(RecryptJob *job, napi_value error) {
  napi_value undefined = Undefined(job->env);
  napi_value function = error ? job->reject.Get() : job->resolve.Get();
  napi_value argument = error ? error : undefined;
  napi_value result = nullptr;
  if (function)
    napi_call_function(job->env, undefined, function, 1, &argument, &result);
}

// Stores the resolve and reject functions of the job's promise.
napi_value CaptureSettlers(napi_env env, napi_callback_info info) {
  size_t count = 2;
  napi_value argv[2] = {nullptr, nullptr};
  void *data = nullptr;
  if (napi_get_cb_info(env, info, &count, argv, nullptr, &data) == napi_ok &&
      count == 2) {
    RecryptJob *job = static_cast<RecryptJob *>(data);
    job->resolve.Reset(env, argv[0]);
    job->reject.Reset(env, argv[1]);
  }
  return nullptr;
}

napi_value CreatePromise(RecryptJob *job) {
  napi_env env = job->env;
  napi_value global = nullptr;
  napi_value constructor = nullptr;
  napi_value executor = nullptr;
  napi_value promise = nullptr;
  if (!Check(env, napi_get_global(env, &global)) ||
      !Get(env, global, "Promise", &constructor) ||
      !Check(env, napi_create_function(env, "executor", NAPI_AUTO_LENGTH,
                                       CaptureSettlers, job, &executor)) ||
      !Check(env, napi_new_instance(env, constructor, 1, &executor, &promise)))
    return nullptr;
  return job->resolve.IsEmpty() || job->reject.IsEmpty() ? nullptr : promise;
}

// Drops the jobs an ending environment never started. Their promises can no
// longer settle, and their references belong to that environment.
void ReleasePendingJobs(void *data) {
  napi_env env = static_cast<napi_env>(data);
  JobQueue &queue = ThreadQueue();
  auto ended = std::stable_partition(
      queue.pending.begin(), queue.pending.end(),
      [env](RecryptJob *job) { return job->env != env; });
  std::for_each(ended, queue.pending.end(), DeleteJob);
  queue.pending.erase(ended, queue.pending.end());
  queue.hooked.erase(std::remove(queue.hooked.begin(), queue.hooked.end(), env),
                     queue.hooked.end());
}

bool AddCleanupHook(napi_env env) {
  JobQueue &queue = ThreadQueue();
  if (std::find(queue.hooked.begin(), queue.hooked.end(), env) !=
      queue.hooked.end())
    return true;
  if (!Check(env, napi_add_env_cleanup_hook(env, ReleasePendingJobs, env)))
    return false;
  queue.hooked.push_back(env);
  return true;
}

void StartNextJob() {
  JobQueue &queue = ThreadQueue();
  while (!queue.running && !queue.pending.empty()) {
    RecryptJob *job = queue.pending.front();
    queue.pending.pop_front();
    if (napi_queue_async_work(job->env, job->work) == napi_ok) {
      queue.running = true;
      return;
    }
    HandleScope scope(job->env);
    napi_value error = nullptr;
    napi_value message = nullptr;
    if (napi_create_string_utf8(job->env,
                                "Unable to schedule the recrypt operation",
                                NAPI_AUTO_LENGTH, &message) == napi_ok &&
        napi_create_error(job->env, nullptr, message, &error) == napi_ok)
      Settle(job, error);
    DeleteJob(job);
  }
}

// Reads the whole JavaScript stream on the JavaScript thread, so the work
// never touches JavaScript objects.
bool DrainReadStream(napi_env env, napi_value stream,
                     std::vector<IOBasicTypes::Byte> &out) {
  ObjectByteReaderWithPosition reader(env, stream);
  reader.SetPosition(0);
  std::vector<IOBasicTypes::Byte> chunk(kStreamChunkSize);
  while (!HasPendingException(env) && reader.NotEnded()) {
    IOBasicTypes::LongBufferSizeType read =
        reader.Read(chunk.data(), chunk.size());
    if (read == 0)
      break;
    out.insert(out.end(), chunk.begin(), chunk.begin() + read);
  }
  return !HasPendingException(env);
}

// Hands the output to the JavaScript stream. False when a write fell short or
// the stream threw; a thrown exception stays pending for the caller.
bool FlushWriteStream(napi_env env, napi_value stream,
                      const std::string &bytes) {
  ObjectByteWriterWithPosition writer(env, stream);
  const IOBasicTypes::Byte *data =
      reinterpret_cast<const IOBasicTypes::Byte *>(bytes.data());
  for (size_t position = 0; position < bytes.size();) {
    size_t amount = std::min(kStreamChunkSize, bytes.size() - position);
    if (writer.Write(data + position, amount) != amount ||
        HasPendingException(env))
      return false;
    position += amount;
  }
  return writer.Flush() == eSuccess && !HasPendingException(env);
}

void Execute(napi_env, void *data) {
  RecryptJob *job = static_cast<RecryptJob *>(data);
  std::lock_guard<std::mutex> lock(RecryptMutex());
  // Each thread has its own trace. Recrypt parses the source before StartPDF
  // applies the log settings, so apply them first, and clear them afterwards
  // so a reused pool thread keeps nothing from this job.
  Trace &trace = Trace::DefaultTrace();
  trace.SetLogSettings(job->options.log.LogFileLocation,
                       job->options.log.ShouldLog,
                       job->options.log.StartWithBOM);
  if (job->usesStreams) {
    InputByteArrayStream input(job->input.data(), job->input.size());
    job->status = PDFWriter::RecryptPDF(&input, job->options.password,
                                        &job->output, job->options.log,
                                        job->options.creation,
                                        job->options.version);
  } else {
    job->status = PDFWriter::RecryptPDF(
        job->sourcePath, job->options.password, job->targetPath,
        job->options.log, job->options.creation, job->options.version);
  }
  trace.SetLogSettings(static_cast<IByteWriter *>(nullptr), false);
  // Pool threads outlive every job. Release the random generator and error
  // state RAND_bytes allocated on this thread.
  OPENSSL_thread_stop();
}

void Complete(napi_env env, napi_status status, void *data) {
  RecryptJob *job = static_cast<RecryptJob *>(data);
  ThreadQueue().running = false;
  {
    HandleScope scope(env);
    napi_value error = nullptr;
    if (status != napi_ok || job->status != eSuccess) {
      napi_value message = nullptr;
      if (napi_create_string_utf8(env, kRecryptFailure, NAPI_AUTO_LENGTH,
                                  &message) == napi_ok)
        napi_create_type_error(env, nullptr, message, &error);
    } else if (job->usesStreams &&
               !FlushWriteStream(env, job->writeStream.Get(),
                                 job->output.ToString())) {
      bool pending = false;
      if (napi_is_exception_pending(env, &pending) == napi_ok && pending)
        napi_get_and_clear_last_exception(env, &error);
      else {
        napi_value message = nullptr;
        if (napi_create_string_utf8(env, kRecryptFailure, NAPI_AUTO_LENGTH,
                                    &message) == napi_ok)
          napi_create_type_error(env, nullptr, message, &error);
      }
    }
    Settle(job, error);
  }
  DeleteJob(job);
  StartNextJob();
}

} // namespace

napi_value RecryptAsync(const CallbackArgs &args) {
  napi_env env = args.Env();
  RecryptJob *job = new RecryptJob();
  job->env = env;
  if (!ReadRecryptArguments(args, job->options)) {
    delete job;
    return nullptr;
  }
  job->usesStreams = IsObject(env, args[0]);
  if (job->usesStreams) {
    if (!job->writeStream.Reset(env, args[1]) ||
        !DrainReadStream(env, args[0], job->input)) {
      delete job;
      return nullptr;
    }
  } else {
    job->sourcePath = LegacyString(env, args[0]);
    job->targetPath = LegacyString(env, args[1]);
  }

  napi_value promise = CreatePromise(job);
  napi_value name = nullptr;
  if (!promise ||
      !Check(env, napi_create_string_utf8(env, "muhammara:recryptAsync",
                                          NAPI_AUTO_LENGTH, &name)) ||
      !Check(env, napi_create_async_work(env, nullptr, name, Execute,
                                         Complete, job, &job->work)) ||
      !AddCleanupHook(env)) {
    DeleteJob(job);
    if (!HasPendingException(env))
      ThrowError(env, "Unable to schedule the recrypt operation");
    return nullptr;
  }
  ThreadQueue().pending.push_back(job);
  StartNextJob();
  return promise;
}
