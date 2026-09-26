#include "ByteWriterDriver.h"

#include "IByteWriter.h"

using namespace muhammara::napi;

ByteWriterDriver::ByteWriterDriver() : mInstance(nullptr), mOwns(false) {}
ByteWriterDriver::~ByteWriterDriver() {
  if (mOwns)
    delete mInstance;
}

bool ByteWriterDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "ByteWriter", New);
  builder.Method("write", Write);
  return builder.Define(exports, false) != nullptr;
}

napi_value ByteWriterDriver::New(const CallbackArgs &args) {
  auto *driver = new ByteWriterDriver();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

void ByteWriterDriver::SetStream(IByteWriter *writer, bool owns) {
  if (mOwns)
    delete mInstance;
  mInstance = writer;
  mOwns = owns;
}
IByteWriter *ByteWriterDriver::GetStream() { return mInstance; }

napi_value ByteWriterDriver::Write(const CallbackArgs &args) {
  size_t length = 0;
  if (args.Length() != 1 || !ByteSourceLength(args.Env(), args[0], &length))
    return ThrowTypeError(
        args.Env(), "Wrong arguments. pass a Uint8Array or an array of bytes");
  std::vector<IOBasicTypes::Byte> buffer(length);
  size_t copied = 0;
  if (!ReadStreamChunk(args.Env(), args[0], buffer.data(), length, &copied))
    return nullptr;
  auto *driver = ObjectWrap::Unwrap<ByteWriterDriver>(args.Env(), args.This());
  return Number(args.Env(), driver->mInstance->Write(buffer.data(), copied));
}
