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
  size_t length = 0;
  if (args.Length() != 1 || !ByteSourceLength(args.Env(), args[0], &length))
    return ThrowTypeError(
        args.Env(), "Wrong arguments. pass a Uint8Array or an array of bytes");
  std::vector<IOBasicTypes::Byte> buffer(length);
  size_t copied = 0;
  if (!ReadStreamChunk(args.Env(), args[0], buffer.data(), length, &copied))
    return nullptr;
  auto *driver = ObjectWrap::Unwrap<ByteWriterWithPositionDriver>(args.Env(), args.This());
  return Number(args.Env(), driver->instance_->Write(buffer.data(), copied));
}
napi_value
ByteWriterWithPositionDriver::GetCurrentPosition(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<ByteWriterWithPositionDriver>(args.Env(), args.This());
  return Number(args.Env(), driver->instance_->GetCurrentPosition());
}
