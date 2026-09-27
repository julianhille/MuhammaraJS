#include "PDFStreamDriver.h"

#include "ByteWriterDriver.h"
#include "ConstructorsHolder.h"
#include "PDFStream.h"
#include "PDFWriterDriver.h"

using namespace muhammara::napi;

PDFStreamDriver::PDFStreamDriver()
    : holder(nullptr), PDFStreamInstance(nullptr), mOwns(false),
      mStreamLifecycle(std::make_shared<DriverLifecycleState>(
          "PDF stream is no longer active")) {}
bool PDFStreamDriver::EndStream() {
  if (!mStreamLifecycle->IsActive())
    return false;
  mStreamLifecycle->End();
  return true;
}
PDFStreamDriver::~PDFStreamDriver() {
  // An unfinished stream deletes the writer's output when destroyed.
  if (openContent && openContent->writer &&
      openContent->streams.erase(PDFStreamInstance))
    openContent->writer->AbandonStream(PDFStreamInstance);
  if (mOwns)
    delete PDFStreamInstance;
}

bool PDFStreamDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFStream", New);
  builder.Method("getWriteStream", GetWriteStream);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFStreamDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFStreamDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

napi_value PDFStreamDriver::GetWriteStream(const CallbackArgs &args) {
  auto *stream = ObjectWrap::Unwrap<PDFStreamDriver>(args.Env(), args.This());
  if (!stream->mStreamLifecycle->IsActive())
    return ThrowError(args.Env(), "PDF stream is no longer active");
  napi_value result = stream->holder->GetNewByteWriter();
  ByteWriterDriver *writer = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), result, &writer))
    return nullptr;
  writer->SetStream(stream->PDFStreamInstance->GetWriteStream(), false);
  writer->AddOwner(stream->Lifecycle());
  writer->AddOwner(stream->mStreamLifecycle);
  return result;
}
