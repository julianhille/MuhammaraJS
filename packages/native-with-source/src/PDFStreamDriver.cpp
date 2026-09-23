#include "PDFStreamDriver.h"

#include "ByteWriterDriver.h"
#include "ConstructorsHolder.h"
#include "PDFStream.h"

using namespace muhammara::napi;

PDFStreamDriver::PDFStreamDriver()
    : holder(nullptr), PDFStreamInstance(nullptr), mOwns(false) {}
PDFStreamDriver::~PDFStreamDriver() {
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
  napi_value result = stream->holder->GetNewByteWriter();
  ByteWriterDriver *writer = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), result, &writer))
    return nullptr;
  writer->SetStream(stream->PDFStreamInstance->GetWriteStream(), false);
  return result;
}
