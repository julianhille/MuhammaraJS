#include "RecryptAsync.h"

#include "InputByteArrayStream.h"
#include "ObjectByteReaderWithPosition.h"
#include "ObjectByteWriterWithPosition.h"
#include "PDFDate.h"
#include "Trace.h"

#include <openssl/crypto.h>

#if defined(_WIN32) || defined(__WIN32__) || defined(WIN32)
#include "SafeBufferMacrosDefs.h"
#include <cstdio>
#include <share.h> // _SH_DENYNO, used by SAFE_FOPEN
#else
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#endif

#include <algorithm>
#include <climits>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <string>
#include <vector>

using namespace muhammara::napi;
using namespace PDFHummus;

namespace {

// Chunk size for moving bytes between the JavaScript streams and memory.
const size_t kStreamChunkSize = 64 * 1024;

constexpr const char *kOutOfMemory =
    "Not enough memory to buffer the recryptAsync() streams";
constexpr const char *kWrittenAfterCall =
    "The output stream was written to after recryptAsync() was called";
constexpr const char *kPathTooLong =
    "A path is too long for this system; recryptAsync() opens its files by "
    "absolute path, so use a shorter path or working directory";
constexpr const char *kSharedOutput =
    "An earlier recryptAsync() call wrote to the same output stream before "
    "this one started; use a separate output stream for each call";

// Bytes in memory that report a failed allocation instead of throwing. This
// file is built without exceptions, so std::bad_alloc from a std::vector
// would end the process.
class ByteBuffer {
public:
  ByteBuffer() = default;
  ByteBuffer(const ByteBuffer &) = delete;
  ByteBuffer &operator=(const ByteBuffer &) = delete;
  ~ByteBuffer() { std::free(data_); }

  // Makes room for capacity bytes in total. False when memory runs out.
  bool Reserve(size_t capacity) {
    if (capacity <= capacity_)
      return true;
    void *grown = std::realloc(data_, capacity);
    if (!grown)
      return false;
    data_ = static_cast<IOBasicTypes::Byte *>(grown);
    capacity_ = capacity;
    return true;
  }
  // Makes room for extra more bytes, growing by half the size so that
  // repeated small writes do not reallocate every time. When memory is short
  // it settles for less spare room rather than none, so that each later
  // write does not fail a large allocation and copy everything again.
  bool Grow(size_t extra) {
    if (extra <= capacity_ - size_)
      return true;
    if (extra > SIZE_MAX - size_)
      return false;
    for (size_t growth = size_ / 2; growth > extra; growth /= 2) {
      if (growth <= SIZE_MAX - size_ && Reserve(size_ + growth))
        return true;
    }
    return Reserve(size_ + extra);
  }
  // Frees the bytes.
  void Clear() {
    std::free(data_);
    data_ = nullptr;
    size_ = 0;
    capacity_ = 0;
  }
  // The free space after the bytes; Commit counts what was written there.
  IOBasicTypes::Byte *End() { return data_ + size_; }
  size_t Spare() const { return capacity_ - size_; }
  void Commit(size_t count) { size_ += count; }

  IOBasicTypes::Byte *Data() { return data_; }
  const IOBasicTypes::Byte *Data() const { return data_; }
  size_t Size() const { return size_; }

private:
  IOBasicTypes::Byte *data_ = nullptr;
  size_t size_ = 0;
  size_t capacity_ = 0;
};

// Collects the output in memory. Positions start where the JavaScript stream
// stood when recryptAsync() was called, so the xref offsets match the bytes
// the stream will hold, as with the synchronous recrypt().
class MemoryOutput : public IByteWriterWithPosition {
public:
  IOBasicTypes::LongBufferSizeType
  Write(const IOBasicTypes::Byte *buffer,
        IOBasicTypes::LongBufferSizeType size) override {
    // After a failed write the output is incomplete; keep failing.
    if (outOfMemory || size == 0)
      return 0;
    if (!bytes.Grow(size)) {
      outOfMemory = true;
      return 0;
    }
    std::memcpy(bytes.End(), buffer, size);
    bytes.Commit(size);
    return size;
  }
  IOBasicTypes::LongFilePositionType GetCurrentPosition() override {
    return start + static_cast<IOBasicTypes::LongFilePositionType>(
                       bytes.Size());
  }

  IOBasicTypes::LongFilePositionType start = 0;
  ByteBuffer bytes;
  bool outOfMemory = false;
};

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
  // Set when an earlier job of this thread wrote to the same output stream
  // while this one waited.
  bool outputWrittenBefore = false;
  std::string sourcePath;
  std::string targetPath;
  RecryptArguments options;
  // The local time zone when recryptAsync() was called. The job uses it for
  // ModDate, the file ID and log timestamps, because reading the time zone on
  // the pool thread calls getenv("TZ"), which races process.env writes.
  PDFDate timeZone;

  ByteBuffer input;
  MemoryOutput output;

  EStatusCode status = eFailure;
};

// Jobs started from this thread that wait for the running one. Only one job
// per thread is on the libuv pool at a time, so this thread's queued jobs
// never hold pool threads that fs, dns and zlib need.
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

// Settles the job's promise, rejecting with error when failed. error may be
// null when creating it failed; the promise still rejects. False once the
// environment can no longer run JavaScript, because it is ending.
bool Settle(RecryptJob *job, bool failed, napi_value error) {
  napi_value undefined = Undefined(job->env);
  napi_value function = failed ? job->reject.Get() : job->resolve.Get();
  napi_value argument = failed && error ? error : undefined;
  napi_value result = nullptr;
  if (!function)
    return false;
  if (napi_call_function(job->env, undefined, function, 1, &argument,
                         &result) == napi_ok)
    return true;
  // Only settle functions from a replaced Promise.prototype.constructor can
  // throw. Their exception stays pending and Node reports it as uncaught; an
  // ending environment fails without one.
  bool pending = false;
  return napi_is_exception_pending(job->env, &pending) == napi_ok && pending;
}

// napi_create_error, napi_create_type_error or napi_create_range_error.
using ErrorFactory = napi_status (*)(napi_env, napi_value, napi_value,
                                     napi_value *);

napi_value NewError(napi_env env, ErrorFactory create, const char *text) {
  napi_value message = nullptr;
  napi_value error = nullptr;
  if (napi_create_string_utf8(env, text, NAPI_AUTO_LENGTH, &message) !=
      napi_ok)
    return nullptr;
  return create(env, nullptr, message, &error) == napi_ok ? error : nullptr;
}

// The job a promise executor fills in. A replaced Promise constructor may keep
// the executor and call it after the job is gone, so this lives as long as the
// executor function, and job is cleared once the promise exists.
struct ExecutorTarget {
  RecryptJob *job = nullptr;
};

void DeleteExecutorTarget(napi_env, void *data, void *) {
  delete static_cast<ExecutorTarget *>(data);
}

// Stores the resolve and reject functions of the job's promise.
napi_value CaptureSettlers(napi_env env, napi_callback_info info) {
  size_t count = 2;
  napi_value argv[2] = {nullptr, nullptr};
  void *data = nullptr;
  if (napi_get_cb_info(env, info, &count, argv, nullptr, &data) == napi_ok &&
      count == 2 && data) {
    RecryptJob *job = static_cast<ExecutorTarget *>(data)->job;
    if (job) {
      job->resolve.Reset(env, argv[0]);
      job->reject.Reset(env, argv[1]);
    }
  }
  return nullptr;
}

// The built-in Promise constructor. globalThis.Promise may be replaced, by
// Bluebird or zone.js for example, so take the constructor of a promise
// napi_create_promise made, and settle that promise at once to free it.
napi_value BuiltinPromise(napi_env env) {
  napi_deferred deferred = nullptr;
  napi_value promise = nullptr;
  napi_value prototype = nullptr;
  napi_value constructor = nullptr;
  if (!Check(env, napi_create_promise(env, &deferred, &promise)))
    return nullptr;
  bool found = Check(env, napi_get_prototype(env, promise, &prototype)) &&
               Get(env, prototype, "constructor", &constructor) &&
               IsType(env, constructor, napi_function);
  napi_resolve_deferred(env, deferred, Undefined(env));
  return found ? constructor : nullptr;
}

napi_value CreatePromise(RecryptJob *job) {
  napi_env env = job->env;
  napi_value constructor = BuiltinPromise(env);
  if (!constructor)
    return nullptr;
  ExecutorTarget *target = new ExecutorTarget();
  target->job = job;
  napi_value executor = nullptr;
  if (!Check(env, napi_create_function(env, "executor", NAPI_AUTO_LENGTH,
                                       CaptureSettlers, target, &executor)) ||
      !Check(env, napi_add_finalizer(env, executor, target,
                                     DeleteExecutorTarget, nullptr,
                                     nullptr))) {
    // No JavaScript has seen the executor yet.
    delete target;
    return nullptr;
  }
  napi_value promise = nullptr;
  bool created =
      Check(env, napi_new_instance(env, constructor, 1, &executor, &promise));
  target->job = nullptr;
  if (!created)
    return nullptr;
  return job->resolve.IsEmpty() || job->reject.IsEmpty() ? nullptr : promise;
}

// Drops the jobs of an ending environment that have not started. Their
// promises can no longer settle, and their references belong to that
// environment.
void DropPendingJobs(napi_env env) {
  JobQueue &queue = ThreadQueue();
  auto ended = std::stable_partition(
      queue.pending.begin(), queue.pending.end(),
      [env](RecryptJob *job) { return job->env != env; });
  std::for_each(ended, queue.pending.end(), DeleteJob);
  queue.pending.erase(ended, queue.pending.end());
}

void ReleasePendingJobs(void *data) {
  napi_env env = static_cast<napi_env>(data);
  DropPendingJobs(env);
  JobQueue &queue = ThreadQueue();
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
    Settle(job, true,
           NewError(job->env, napi_create_error,
                    "Unable to schedule the recrypt operation"));
    DeleteJob(job);
  }
}

// Reads the whole JavaScript stream on the JavaScript thread, so the work
// never touches JavaScript objects. The stream's length sizes the buffer, so
// it is allocated once instead of grown. False with an exception pending when
// the stream threw or memory ran out.
bool DrainReadStream(napi_env env, napi_value stream, ByteBuffer &out) {
  ObjectByteReaderWithPosition reader(env, stream);
  reader.SetPositionFromEnd(0);
  if (HasPendingException(env))
    return false;
  IOBasicTypes::LongFilePositionType length = reader.GetCurrentPosition();
  if (HasPendingException(env))
    return false;
  reader.SetPosition(0);
  if (HasPendingException(env))
    return false;
  if (length > 0 &&
      (static_cast<unsigned long long>(length) > SIZE_MAX ||
       !out.Reserve(static_cast<size_t>(length)))) {
    ThrowRangeError(env, kOutOfMemory);
    return false;
  }
  while (reader.NotEnded() && !HasPendingException(env)) {
    if (out.Spare() == 0 && !out.Grow(kStreamChunkSize)) {
      ThrowRangeError(env, kOutOfMemory);
      return false;
    }
    IOBasicTypes::LongBufferSizeType read =
        reader.Read(out.End(), std::min(out.Spare(), kStreamChunkSize));
    if (HasPendingException(env))
      return false;
    out.Commit(read);
    if (read == 0)
      break;
  }
  return !HasPendingException(env);
}

// Hands the output to the JavaScript stream. False when a write fell short or
// the stream threw; a thrown exception stays pending for the caller.
bool FlushWriteStream(napi_env env, napi_value stream, const ByteBuffer &bytes) {
  ObjectByteWriterWithPosition writer(env, stream);
  const IOBasicTypes::Byte *data = bytes.Data();
  for (size_t position = 0; position < bytes.Size();) {
    size_t amount = std::min(kStreamChunkSize, bytes.Size() - position);
    if (writer.Write(data + position, amount) != amount ||
        HasPendingException(env))
      return false;
    position += amount;
  }
  return writer.Flush() == eSuccess && !HasPendingException(env);
}

void Execute(napi_env, void *data) {
  RecryptJob *job = static_cast<RecryptJob *>(data);
  LogConfiguration log = UsableRecryptLog(job->options.log);
  // Both are cleared afterwards, so a reused pool thread keeps nothing from
  // this job.
  UseRecryptLog(log);
  PDFDate::SetThreadTimeZone(job->timeZone);
  if (job->usesStreams) {
    // A recrypted PDF is about as large as its source. Reserving that much
    // usually avoids growing the output; if it fails, growing still may not.
    job->output.bytes.Reserve(job->input.Size());
    InputByteArrayStream input(
        job->input.Data(),
        static_cast<IOBasicTypes::LongFilePositionType>(job->input.Size()));
    job->status = PDFWriter::RecryptPDF(&input, job->options.password,
                                        &job->output, log,
                                        job->options.creation,
                                        job->options.version);
    // Only the output is needed from here on.
    job->input.Clear();
  } else {
    job->status = PDFWriter::RecryptPDF(
        job->sourcePath, job->options.password, job->targetPath, log,
        job->options.creation, job->options.version);
  }
  ClearRecryptLog();
  PDFDate::ClearThreadTimeZone();
  // Pool threads outlive every job. Release the random generator and error
  // state RAND_bytes allocated on this thread.
  OPENSSL_thread_stop();
}

// Whether a path is too long to open. recryptAsync() makes relative paths
// absolute when it is called, which can pass the system's limit where
// recrypt() still opens the relative path from inside the directory.
bool TooLong(const std::string &path) {
#if defined(_WIN32) || defined(__WIN32__) || defined(WIN32)
  (void)path;
  return false;
#else
  return path.size() >= PATH_MAX;
#endif
}

// The exception a JavaScript stream method threw, if any.
bool TakeException(napi_env env, napi_value *error) {
  bool pending = false;
  if (napi_is_exception_pending(env, &pending) != napi_ok || !pending)
    return false;
  napi_get_and_clear_last_exception(env, error);
  return true;
}

// Marks the waiting jobs that write to stream, which a job just wrote to, so
// their error names the earlier job instead of blaming the caller.
void MarkSharedOutput(napi_env env, napi_value stream) {
  for (RecryptJob *other : ThreadQueue().pending) {
    bool same = false;
    if (other->env == env && other->usesStreams &&
        napi_strict_equals(env, other->writeStream.Get(), stream, &same) ==
            napi_ok &&
        same)
      other->outputWrittenBefore = true;
  }
}

void Complete(napi_env env, napi_status status, void *data) {
  RecryptJob *job = static_cast<RecryptJob *>(data);
  {
    HandleScope scope(env);
    bool failed = false;
    napi_value error = nullptr;
    if (job->output.outOfMemory) {
      failed = true;
      error = NewError(env, napi_create_range_error, kOutOfMemory);
    } else if (status != napi_ok || job->status != eSuccess) {
      failed = true;
      error = NewError(env, napi_create_type_error, kRecryptFailure);
    } else if (job->usesStreams) {
      napi_value stream = job->writeStream.Get();
      ObjectByteWriterWithPosition probe(env, stream);
      IOBasicTypes::LongFilePositionType position = probe.GetCurrentPosition();
      if (TakeException(env, &error)) {
        failed = true;
      } else if (position != job->output.start) {
        // The xref offsets assume the stream position at the call.
        failed = true;
        error = NewError(env, napi_create_error,
                         job->outputWrittenBefore ? kSharedOutput
                                                  : kWrittenAfterCall);
      } else {
        // Before writing: a failed write leaves an exception pending, which
        // napi_strict_equals refuses to run with. A job marked although
        // nothing was written still finds its position unchanged.
        MarkSharedOutput(env, stream);
        if (!FlushWriteStream(env, stream, job->output.bytes)) {
          failed = true;
          if (!TakeException(env, &error))
            error = NewError(env, napi_create_type_error, kRecryptFailure);
        }
      }
    }
    if (!Settle(job, failed, error)) {
      // The environment is ending. Node waits for queued work before its
      // cleanup hooks run, so drop the waiting jobs now instead of running
      // every one of them first.
      DropPendingJobs(env);
    }
  }
  DeleteJob(job);
  // Only now: a recryptAsync() call from a stream method above queues behind
  // the jobs already waiting, after they were marked.
  ThreadQueue().running = false;
  StartNextJob();
}

// Takes what a stream job needs from the JavaScript streams now: the output
// position and the whole source. False with an exception pending when a
// stream threw or memory ran out.
bool ReadStreams(RecryptJob *job, napi_value source, napi_value target) {
  napi_env env = job->env;
  if (!job->writeStream.Reset(env, target))
    return false;
  ObjectByteWriterWithPosition writer(env, target);
  job->output.start = writer.GetCurrentPosition();
  return !HasPendingException(env) &&
         DrainReadStream(env, source, job->input);
}

} // namespace

LogConfiguration UsableRecryptLog(const LogConfiguration &log) {
  LogConfiguration usable = log;
  if (!usable.ShouldLog || usable.LogStream)
    return usable;
  // A missing file is fine: Log creates it, or turns itself off.
#if defined(_WIN32) || defined(__WIN32__) || defined(WIN32)
  FILE *file = nullptr;
  SAFE_FOPEN(file, usable.LogFileLocation.c_str(), "r")
  if (!file)
    return usable;
  fclose(file);
  SAFE_FOPEN(file, usable.LogFileLocation.c_str(), "ab")
  if (file)
    fclose(file);
  else
    usable.ShouldLog = false;
#else
  struct stat status;
  if (stat(usable.LogFileLocation.c_str(), &status) != 0)
    return usable;
  if (S_ISDIR(status.st_mode)) {
    usable.ShouldLog = false;
    return usable;
  }
  // Open it the way Log's fopen "ab" will, without waiting: a FIFO without a
  // reader fails instead of blocking, as does a read-only device. O_CREAT
  // counts even for an existing file, as Linux's protected_regular refuses
  // it in a sticky directory for a file another user owns. Log still waits
  // for a writer when it opens a FIFO to read.
  int descriptor = open(
      usable.LogFileLocation.c_str(),
      O_WRONLY | O_APPEND | O_CREAT | O_NONBLOCK | O_NOCTTY | O_CLOEXEC, 0666);
  if (descriptor >= 0)
    close(descriptor);
  else
    usable.ShouldLog = false;
#endif
  return usable;
}

void UseRecryptLog(const LogConfiguration &log) {
  Trace::DefaultTrace().SetLogSettings(log.LogFileLocation, log.ShouldLog,
                                       log.StartWithBOM);
}

void ClearRecryptLog() {
  Trace::DefaultTrace().SetLogSettings(static_cast<IByteWriter *>(nullptr),
                                       false);
}

namespace {

// The log a writer last handed PDFWriter on this thread; none at first, as
// the trace starts without one.
LogConfiguration &WriterLog() {
  thread_local LogConfiguration log(false, false, "");
  return log;
}

} // namespace

void RecordWriterLog(const LogConfiguration &log) { WriterLog() = log; }

void ClearWriterLog() {
  WriterLog() = LogConfiguration(false, false, "");
  ClearRecryptLog();
}

void RestoreWriterLog() {
  const LogConfiguration &log = WriterLog();
  if (log.LogStream)
    Trace::DefaultTrace().SetLogSettings(log.LogStream, log.ShouldLog);
  else
    Trace::DefaultTrace().SetLogSettings(log.LogFileLocation, log.ShouldLog,
                                         log.StartWithBOM);
}

napi_value RecryptAsync(const CallbackArgs &args) {
  napi_env env = args.Env();
  RecryptJob *job = new RecryptJob();
  job->env = env;
  if (!ReadRecryptArguments(args, job->options)) {
    delete job;
    return nullptr;
  }
  job->timeZone.SetToCurrentTime();
  job->usesStreams = IsObject(env, args[0]);

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
  bool tooLong = job->options.log.ShouldLog &&
                 TooLong(job->options.log.LogFileLocation);
  if (!job->usesStreams) {
    job->sourcePath = LegacyString(env, args[0]);
    job->targetPath = LegacyString(env, args[1]);
    tooLong = tooLong || TooLong(job->sourcePath) || TooLong(job->targetPath);
  }
  if (tooLong) {
    Settle(job, true, NewError(env, napi_create_error, kPathTooLong));
    DeleteJob(job);
    return promise;
  }
  if (job->usesStreams) {
    // Only wrong arguments throw. A stream that throws, or a source too large
    // for memory, rejects like any other failure once the call is accepted.
    if (!ReadStreams(job, args[0], args[1])) {
      napi_value error = nullptr;
      if (!TakeException(env, &error))
        error = NewError(env, napi_create_type_error, kRecryptFailure);
      Settle(job, true, error);
      DeleteJob(job);
      return promise;
    }
  }
  ThreadQueue().pending.push_back(job);
  StartNextJob();
  return promise;
}
