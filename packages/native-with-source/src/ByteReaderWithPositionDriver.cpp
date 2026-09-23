#include "ByteReaderWithPositionDriver.h"

#include "IByteReaderWithPosition.h"

using namespace muhammara::napi;

ByteReaderWithPositionDriver::ByteReaderWithPositionDriver()
    : mInstance(nullptr), mOwns(false) {}

ByteReaderWithPositionDriver::~ByteReaderWithPositionDriver() {
  if (mOwns)
    delete mInstance;
}

bool ByteReaderWithPositionDriver::Init(ModuleState &state,
                                        napi_value exports) {
  ClassBuilder builder(state, "ByteReaderWithPosition", New);
  builder.Method("read", Read)
      .Method("notEnded", NotEnded)
      .Method("setPosition", SetPosition)
      .Method("getCurrentPosition", GetCurrentPosition)
      .Method("setPositionFromEnd", SetPositionFromEnd)
      .Method("skip", Skip);
  return builder.Define(exports, false) != nullptr;
}

napi_value ByteReaderWithPositionDriver::New(const CallbackArgs &args) {
  auto *driver = new ByteReaderWithPositionDriver();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

void ByteReaderWithPositionDriver::SetStream(IByteReaderWithPosition *reader,
                                             bool owns) {
  if (mOwns)
    delete mInstance;
  mInstance = reader;
  mOwns = owns;
}

IByteReaderWithPosition *ByteReaderWithPositionDriver::GetStream() {
  return mInstance;
}

napi_value ByteReaderWithPositionDriver::Read(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_number))
    return ThrowError(args.Env(),
                      "Wrong arguments. pass the number of bytes to read");
  auto *driver =
      ObjectWrap::Unwrap<ByteReaderWithPositionDriver>(args.Env(), args.This());
  IOBasicTypes::LongBufferSizeType size = ToUint32(args.Env(), args[0]);
  std::vector<IOBasicTypes::Byte> buffer(size);
  size = driver->mInstance->Read(buffer.data(), static_cast<int>(size));
  return BytesToArray(args.Env(), buffer.data(), size);
}

napi_value ByteReaderWithPositionDriver::NotEnded(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<ByteReaderWithPositionDriver>(args.Env(), args.This());
  return Boolean(args.Env(), driver->mInstance->NotEnded());
}

napi_value
ByteReaderWithPositionDriver::GetCurrentPosition(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<ByteReaderWithPositionDriver>(args.Env(), args.This());
  return Number(args.Env(), driver->mInstance->GetCurrentPosition());
}

napi_value ByteReaderWithPositionDriver::Skip(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_number))
    return ThrowError(args.Env(),
                      "Wrong arguments. pass the number of bytes to skip");
  auto *driver =
      ObjectWrap::Unwrap<ByteReaderWithPositionDriver>(args.Env(), args.This());
  driver->mInstance->Skip(ToUint32(args.Env(), args[0]));
  return args.This();
}

napi_value ByteReaderWithPositionDriver::SetPosition(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_number))
    return ThrowError(args.Env(), "Wrong arguments. pass the position");
  auto *driver =
      ObjectWrap::Unwrap<ByteReaderWithPositionDriver>(args.Env(), args.This());
  driver->mInstance->SetPosition(ToUint32(args.Env(), args[0]));
  return args.This();
}

napi_value
ByteReaderWithPositionDriver::SetPositionFromEnd(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_number))
    return ThrowError(args.Env(), "Wrong arguments. pass the position");
  auto *driver =
      ObjectWrap::Unwrap<ByteReaderWithPositionDriver>(args.Env(), args.This());
  driver->mInstance->SetPositionFromEnd(ToUint32(args.Env(), args[0]));
  return args.This();
}
