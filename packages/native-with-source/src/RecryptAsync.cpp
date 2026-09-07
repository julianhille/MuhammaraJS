/*
 Source File : RecryptAsync.cpp


 Copyright 2026 Julian Hille MuhammaraJS

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 */
#include "RecryptAsync.h"

#include "ObjectByteReaderWithPosition.h"
#include "ObjectByteWriterWithPosition.h"

#include "EStatusCode.h"
#include "IByteReaderWithPosition.h"
#include "OutputStringBufferStream.h"
#include "Trace.h"

#include <uv.h>

#include <cstring>
#include <string>
#include <vector>

using namespace v8;
using namespace node;

const char* const scRecryptFailureMessage =
    "Unable to recrypt files, check that input and output files are clear and arguments are coool";

// The native build provides a thread-local Trace. Libuv reuses its threads, so
// clear each job's settings even when PDF processing throws or fails early.
struct RecryptTraceScope
{
    Trace& trace;
    RecryptTraceScope() : trace(Trace::DefaultTrace()) {}
    ~RecryptTraceScope() { trace.SetLogSettings(static_cast<IByteWriter*>(NULL), false); }
};

// Chunk size for moving bytes between the JS stream objects and memory. The
// stream proxies build one JS array entry per byte, so the synchronous recrypt
// already pays this cost; comparable chunks keep the profile the same.
static const size_t scStreamChunkSize = 64 * 1024;


// Reads the buffered input off-thread. A dedicated reader rather than
// InputStringBufferStream, because the parser seeks relative to the current
// position and std::stringbuf refuses an ios_base::cur seek while its put area
// is open.
class MemoryByteReaderWithPosition : public IByteReaderWithPosition
{
public:
    explicit MemoryByteReaderWithPosition(const std::string& inBytes)
        : mBytes(inBytes), mPosition(0) {}

    virtual IOBasicTypes::LongBufferSizeType Read(IOBasicTypes::Byte* inBuffer,
                                                  IOBasicTypes::LongBufferSizeType inBufferSize)
    {
        size_t available = mBytes.size() - mPosition;
        size_t amount = (inBufferSize < available) ? (size_t)inBufferSize : available;
        if (amount > 0) {
            memcpy(inBuffer, mBytes.data() + mPosition, amount);
            mPosition += amount;
        }
        return (IOBasicTypes::LongBufferSizeType)amount;
    }

    virtual bool NotEnded() { return mPosition < mBytes.size(); }

    virtual void Skip(IOBasicTypes::LongBufferSizeType inSkipSize)
    {
        mPosition = (mBytes.size() - mPosition < inSkipSize) ? mBytes.size() : mPosition + (size_t)inSkipSize;
    }

    virtual void SetPosition(IOBasicTypes::LongFilePositionType inOffsetFromStart)
    {
        if (inOffsetFromStart < 0)
            mPosition = 0;
        else if ((size_t)inOffsetFromStart > mBytes.size())
            mPosition = mBytes.size();
        else
            mPosition = (size_t)inOffsetFromStart;
    }

    virtual void SetPositionFromEnd(IOBasicTypes::LongFilePositionType inOffsetFromEnd)
    {
        if (inOffsetFromEnd < 0 || (size_t)inOffsetFromEnd > mBytes.size())
            mPosition = 0;
        else
            mPosition = mBytes.size() - (size_t)inOffsetFromEnd;
    }

    virtual IOBasicTypes::LongFilePositionType GetCurrentPosition()
    {
        return (IOBasicTypes::LongFilePositionType)mPosition;
    }

private:
    const std::string& mBytes;
    size_t mPosition;
};

struct RecryptWork
{
    uv_work_t request;

    Isolate* isolate;
    Global<Promise::Resolver> resolver;
    Global<Context> context;
    // Keeps async_hooks informed, and gives CallbackScope something to attach
    // the completion to so microtasks are drained the way Node expects.
    Global<Object> asyncResource;
    node::async_context asyncContext;
    // Only set for the stream overload; the produced bytes are handed to this
    // JS object once the background work is done.
    Global<Object> writeStream;

    bool usesStreams;
    std::string originalPath;
    std::string newPath;
    std::string originalPassword;
    EPDFVersion pdfVersion;
    PDFCreationSettings creationSettings;
    LogConfiguration logConfiguration;

    std::string inputBytes;
    OutputStringBufferStream outputBuffer;

    PDFHummus::EStatusCode status;

    RecryptWork()
        : isolate(NULL),
          usesStreams(false),
          pdfVersion(ePDFVersionUndefined),
          creationSettings(true, true),
          logConfiguration(LogConfiguration::DefaultLogConfiguration()),
          status(PDFHummus::eFailure)
    {
        request.data = this;
        asyncContext.async_id = 0;
        asyncContext.trigger_async_id = 0;
    }
};

bool ParseRecryptArguments(Isolate* isolate,
                           const ARGS_TYPE& args,
                           EPDFVersion& outPDFVersion,
                           PDFCreationSettings& outCreationSettings,
                           LogConfiguration& outLogConfiguration,
                           std::string& outOriginalPassword)
{
    if (args.Length() < 2 || args.Length() > 3) {
        THROW_EXCEPTION("Wrong number of arguments, Provide one argument stating the location of the source file, a second one for the destination file, and an optional options object");
        return false;
    }

    if (!args[0]->IsString() && !args[0]->IsObject()) {
        THROW_EXCEPTION("Wrong arguments, please provide a path to a file as the first argument or a stream object");
        return false;
    }

    if (!args[1]->IsString() && !args[1]->IsObject()) {
        THROW_EXCEPTION("Wrong arguments, please provide a path to a file as the second argument or a stream object");
        return false;
    }

    if ((args[1]->IsString() && !args[0]->IsString()) || (args[1]->IsObject() && !args[0]->IsObject())) {
        THROW_EXCEPTION("Wrong arguments, please either provide two paths or two stream objects for the first two arguments");
        return false;
    }

    if (args.Length() == 3 && args[2]->IsObject())
    {
        Local<Object> anObject = args[2]->TO_OBJECT();
        if(anObject->Has(GET_CURRENT_CONTEXT, NEW_STRING("version")).FromJust() && anObject->Get(GET_CURRENT_CONTEXT, NEW_STRING("version")).ToLocalChecked()->IsNumber())
        {
            long pdfVersionValue = TO_INT32(anObject->Get(GET_CURRENT_CONTEXT, NEW_STRING("version")).ToLocalChecked())->Value();

            if(pdfVersionValue != ePDFVersionUndefined && (pdfVersionValue < ePDFVersion10 || ePDFVersionMax < pdfVersionValue))
            {
                THROW_EXCEPTION("Wrong argument for PDF version, please provide a valid PDF version");
                return false;
            }
            outPDFVersion = (EPDFVersion)pdfVersionValue;
        }

        if(anObject->Has(GET_CURRENT_CONTEXT, NEW_STRING("compress")).FromJust() && anObject->Get(GET_CURRENT_CONTEXT, NEW_STRING("compress")).ToLocalChecked()->IsBoolean())
            outCreationSettings.CompressStreams = anObject->Get(GET_CURRENT_CONTEXT, NEW_STRING("compress")).ToLocalChecked()->TO_BOOLEAN()->Value();

        if(anObject->Has(GET_CURRENT_CONTEXT, NEW_STRING("log")).FromJust() && anObject->Get(GET_CURRENT_CONTEXT, NEW_STRING("log")).ToLocalChecked()->IsString())
        {
            outLogConfiguration.ShouldLog = true;
            outLogConfiguration.LogFileLocation = *UTF_8_VALUE(anObject->Get(GET_CURRENT_CONTEXT, NEW_STRING("log")).ToLocalChecked()->TO_STRING());
        }

        if(anObject->Has(GET_CURRENT_CONTEXT, NEW_STRING("password")).FromJust() && anObject->Get(GET_CURRENT_CONTEXT, NEW_STRING("password")).ToLocalChecked()->IsString())
        {
            outOriginalPassword = *UTF_8_VALUE(anObject->Get(GET_CURRENT_CONTEXT, NEW_STRING("password")).ToLocalChecked()->TO_STRING());
        }

        if(anObject->Has(GET_CURRENT_CONTEXT, NEW_STRING("userPassword")).FromJust() && anObject->Get(GET_CURRENT_CONTEXT, NEW_STRING("userPassword")).ToLocalChecked()->IsString())
        {
            outCreationSettings.DocumentEncryptionOptions.ShouldEncrypt = true;
            outCreationSettings.DocumentEncryptionOptions.UserPassword = *UTF_8_VALUE(anObject->Get(GET_CURRENT_CONTEXT, NEW_STRING("userPassword")).ToLocalChecked()->TO_STRING());
        }

        if(anObject->Has(GET_CURRENT_CONTEXT, NEW_STRING("ownerPassword")).FromJust() && anObject->Get(GET_CURRENT_CONTEXT, NEW_STRING("ownerPassword")).ToLocalChecked()->IsString())
        {
            outCreationSettings.DocumentEncryptionOptions.OwnerPassword = *UTF_8_VALUE(anObject->Get(GET_CURRENT_CONTEXT, NEW_STRING("ownerPassword")).ToLocalChecked()->TO_STRING());
        }

        if(anObject->Has(GET_CURRENT_CONTEXT, NEW_STRING("userProtectionFlag")).FromJust() && anObject->Get(GET_CURRENT_CONTEXT, NEW_STRING("userProtectionFlag")).ToLocalChecked()->IsNumber())
        {
            outCreationSettings.DocumentEncryptionOptions.UserProtectionOptionsFlag = TO_INT32(anObject->Get(GET_CURRENT_CONTEXT, NEW_STRING("userProtectionFlag")).ToLocalChecked())->Value();
        }
        else // default to print only
            outCreationSettings.DocumentEncryptionOptions.UserProtectionOptionsFlag = 4;
    }

    return true;
}

// Drains the whole JS read stream into memory. Runs on the main thread, because
// ObjectByteReaderWithPosition calls back into JS on every read.
static void DrainReadStream(Local<Object> inReadStream, std::string& outBytes)
{
    ObjectByteReaderWithPosition reader(inReadStream);
    std::vector<IOBasicTypes::Byte> chunk(scStreamChunkSize);

    reader.SetPosition(0);

    while (reader.NotEnded()) {
        IOBasicTypes::LongBufferSizeType read =
            reader.Read(&chunk[0], (IOBasicTypes::LongBufferSizeType)scStreamChunkSize);
        if (0 == read)
            break;

        outBytes.append((const char*)&chunk[0], (size_t)read);
    }
}

// Hands the produced bytes to the JS write stream. Runs on the main thread for
// the same reason DrainReadStream does. ObjectByteWriterWithPosition rethrows a
// JS exception raised by the stream, so the caller has to check for one.
static void FlushWriteStream(Local<Object> inWriteStream, const std::string& inBytes)
{
    ObjectByteWriterWithPosition writer(inWriteStream);

    size_t position = 0;
    while (position < inBytes.size()) {
        size_t amount = inBytes.size() - position;
        if (amount > scStreamChunkSize)
            amount = scStreamChunkSize;

        writer.Write((const IOBasicTypes::Byte*)inBytes.data() + position,
                     (IOBasicTypes::LongBufferSizeType)amount);

        position += amount;
    }
}

static void RecryptWorkCallback(uv_work_t* inRequest)
{
    RecryptWork* work = static_cast<RecryptWork*>(inRequest->data);

    try {
        RecryptTraceScope traceScope;
        // Recrypt parses the source before StartPDF configures logging.
        traceScope.trace.SetLogSettings(work->logConfiguration.LogFileLocation,
                                        work->logConfiguration.ShouldLog,
                                        work->logConfiguration.StartWithBOM);

        if (work->usesStreams) {
            MemoryByteReaderWithPosition input(work->inputBytes);
            work->status = PDFWriter::RecryptPDF(&input,
                                             work->originalPassword,
                                             &work->outputBuffer,
                                             work->logConfiguration,
                                             work->creationSettings,
                                             work->pdfVersion);
        }
        else {
            work->status = PDFWriter::RecryptPDF(work->originalPath,
                                             work->originalPassword,
                                             work->newPath,
                                             work->logConfiguration,
                                             work->creationSettings,
                                             work->pdfVersion);
        }
    }
    catch (...) {
        // Exceptions must not escape a libuv worker and terminate the server.
        work->status = PDFHummus::eFailure;
    }
}

static void RecryptAfterWorkCallback(uv_work_t* inRequest, int inStatus)
{
    RecryptWork* work = static_cast<RecryptWork*>(inRequest->data);
    Isolate* isolate = work->isolate;

    HandleScope handleScope(isolate);
    // The current context is empty inside a libuv callback, so the one captured
    // when the promise was created has to be entered explicitly.
    Local<Context> context = Local<Context>::New(isolate, work->context);
    Context::Scope contextScope(context);

    {
        // Drains microtasks on destruction, so the promise continuations run
        // before control returns to the loop.
        node::CallbackScope callbackScope(isolate,
                                          Local<Object>::New(isolate, work->asyncResource),
                                          work->asyncContext);

        Local<Promise::Resolver> resolver = Local<Promise::Resolver>::New(isolate, work->resolver);
        bool rejected = false;

        if (inStatus != 0 || PDFHummus::eSuccess != work->status) {
            Local<Value> error = Exception::TypeError(
                String::NewFromUtf8(isolate, scRecryptFailureMessage, v8::NewStringType::kNormal).ToLocalChecked());
            resolver->Reject(context, error).FromMaybe(false);
            rejected = true;
        }
        else if (work->usesStreams) {
            TryCatch tryCatch(isolate);
            FlushWriteStream(Local<Object>::New(isolate, work->writeStream), work->outputBuffer.ToString());
            if (tryCatch.HasCaught()) {
                Local<Value> error = tryCatch.Exception();
                tryCatch.Reset();
                resolver->Reject(context, error).FromMaybe(false);
                rejected = true;
            }
        }

        if (!rejected)
            resolver->Resolve(context, Undefined(isolate)).FromMaybe(false);
    }

    node::EmitAsyncDestroy(isolate, work->asyncContext);
    delete work;
}

METHOD_RETURN_TYPE RecryptAsync(const ARGS_TYPE& args)
{
    CREATE_ISOLATE_CONTEXT;
    CREATE_ESCAPABLE_SCOPE;

    EPDFVersion pdfVersion = ePDFVersionUndefined;
    PDFCreationSettings creationSettings(true, true);
    LogConfiguration logConfiguration = LogConfiguration::DefaultLogConfiguration();
    std::string originalPassword;

    if (!ParseRecryptArguments(isolate, args, pdfVersion, creationSettings, logConfiguration, originalPassword)) {
        SET_FUNCTION_RETURN_VALUE(UNDEFINED)
    }

    Local<Context> context = GET_CURRENT_CONTEXT;
    Local<Promise::Resolver> resolver;
    if (!Promise::Resolver::New(context).ToLocal(&resolver)) {
        SET_FUNCTION_RETURN_VALUE(UNDEFINED)
    }

    RecryptWork* work = new RecryptWork();
    work->isolate = isolate;
    work->resolver.Reset(isolate, resolver);
    work->context.Reset(isolate, context);
    work->pdfVersion = pdfVersion;
    work->creationSettings = creationSettings;
    work->logConfiguration = logConfiguration;
    work->originalPassword = originalPassword;
    work->usesStreams = args[0]->IsObject();

    if (work->usesStreams) {
        work->writeStream.Reset(isolate, args[1]->TO_OBJECT());

        // Reading happens here, on the main thread, so the background work
        // never touches the JS stream objects.
        DrainReadStream(args[0]->TO_OBJECT(), work->inputBytes);
    }
    else {
        work->originalPath = std::string(*UTF_8_VALUE(args[0]->TO_STRING()));
        work->newPath = std::string(*UTF_8_VALUE(args[1]->TO_STRING()));
    }

    Local<Object> asyncResource = Object::New(isolate);
    work->asyncResource.Reset(isolate, asyncResource);
    work->asyncContext = node::EmitAsyncInit(isolate, asyncResource, "muhammara:recryptAsync");

    // The event loop of the current environment, not uv_default_loop(), so the
    // addon keeps working when loaded inside a worker thread.
    uv_loop_t* loop = node::GetCurrentEventLoop(isolate);
    int queued = uv_queue_work(loop, &work->request, RecryptWorkCallback, RecryptAfterWorkCallback);
    if (0 != queued) {
        node::EmitAsyncDestroy(isolate, work->asyncContext);
        delete work;
        THROW_EXCEPTION("Unable to schedule the recrypt operation");
        SET_FUNCTION_RETURN_VALUE(UNDEFINED)
    }

    SET_FUNCTION_RETURN_VALUE(resolver->GetPromise())
}
