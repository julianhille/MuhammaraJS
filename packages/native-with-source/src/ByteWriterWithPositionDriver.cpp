#include "ByteWriterWithPositionDriver.h"

#include "IByteWriterWithPosition.h"

using namespace muhammara::napi;

ByteWriterWithPositionDriver::ByteWriterWithPositionDriver()
    : instance_(nullptr), owns_(false) {}
ByteWriterWithPositionDriver::~ByteWriterWithPositionDriver() {
  if (owns_)
    delete instance_;
}
bool ByteWriterWithPositionDriver::Init(ModuleState &state,
                                        napi_value exports) {
  ClassBuilder builder(state, "ByteWriterWithPosition", New);
  builder.Method("write", Write)
      .Method("getCurrentPosition", GetCurrentPosition);
  return builder.Define(exports, false) != nullptr;
}
napi_value ByteWriterWithPositionDriver::New(const CallbackArgs &args) {
  auto *driver = new ByteWriterWithPositionDriver();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}
void ByteWriterWithPositionDriver::SetStream(IByteWriterWithPosition *stream,
                                             bool owns) {
  if (owns_)
    delete instance_;
  instance_ = stream;
  owns_ = owns;
}
IByteWriterWithPosition *ByteWriterWithPositionDriver::GetStream() {
  return instance_;
}
napi_value ByteWriterWithPositionDriver::Write(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsArray(args.Env(), args[0]))
    return ThrowTypeError(args.Env(),
                          "Wrong arguments. pass an array of bytes to write");
  auto *driver =
      ObjectWrap::Unwrap<ByteWriterWithPositionDriver>(args.Env(), args.This());
  uint32_t size = 0;
  if (!Length(args.Env(), args[0], &size))
    return nullptr;
  std::vector<IOBasicTypes::Byte> buffer(size);
  for (uint32_t i = 0; i < size; ++i) {
    napi_value value = nullptr;
    uint32_t byte = 0;
    if (!Get(args.Env(), args[0], i, &value) ||
        !CoerceToUint32(args.Env(), value, &byte))
      return nullptr;
    buffer[i] = static_cast<IOBasicTypes::Byte>(byte);
  }
  return Number(args.Env(), driver->instance_->Write(buffer.data(), size));
}
napi_value
ByteWriterWithPositionDriver::GetCurrentPosition(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<ByteWriterWithPositionDriver>(args.Env(), args.This());
  return Number(args.Env(), driver->instance_->GetCurrentPosition());
}
