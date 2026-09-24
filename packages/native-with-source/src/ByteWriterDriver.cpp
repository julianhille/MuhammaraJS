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
  if (args.Length() != 1 || !IsArray(args.Env(), args[0]))
    return ThrowTypeError(args.Env(),
                          "Wrong arguments. pass an array of bytes to write");
  uint32_t length = 0;
  if (!Length(args.Env(), args[0], &length))
    return nullptr;
  std::vector<IOBasicTypes::Byte> buffer(length);
  for (uint32_t i = 0; i < length; ++i) {
    napi_value value = nullptr;
    uint32_t byte = 0;
    if (!Get(args.Env(), args[0], i, &value) ||
        !CoerceToUint32(args.Env(), value, &byte))
      return nullptr;
    buffer[i] = static_cast<IOBasicTypes::Byte>(byte);
  }
  auto *driver = ObjectWrap::Unwrap<ByteWriterDriver>(args.Env(), args.This());
  return Number(args.Env(), driver->mInstance->Write(buffer.data(), length));
}
