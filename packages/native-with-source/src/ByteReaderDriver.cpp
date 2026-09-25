#include "ByteReaderDriver.h"

#include "IByteReader.h"

using namespace muhammara::napi;

ByteReaderDriver::ByteReaderDriver() : mInstance(nullptr), mOwns(false) {}

ByteReaderDriver::~ByteReaderDriver() {
  if (mOwns)
    delete mInstance;
}

bool ByteReaderDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "ByteReader", New);
  builder.Method("read", Read).Method("notEnded", NotEnded);
  return builder.Define(exports, false) != nullptr;
}

napi_value ByteReaderDriver::New(const CallbackArgs &args) {
  auto *driver = new ByteReaderDriver();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

void ByteReaderDriver::SetStream(IByteReader *reader, bool owns) {
  if (mOwns)
    delete mInstance;
  mInstance = reader;
  mOwns = owns;
}

IByteReader *ByteReaderDriver::GetStream() { return mInstance; }

napi_value ByteReaderDriver::Read(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_number)) {
    return ThrowTypeError(args.Env(),
                          "Wrong arguments. pass the number of bytes to read");
  }
  auto *driver = ObjectWrap::Unwrap<ByteReaderDriver>(args.Env(), args.This());
  if (!driver->mInstance)
    return ThrowError(args.Env(), "Byte reader has no stream");
  IOBasicTypes::LongBufferSizeType size = ToUint32(args.Env(), args[0]);
  std::vector<IOBasicTypes::Byte> buffer(size);
  size = driver->mInstance->Read(buffer.data(), static_cast<int>(size));
  return BytesToBuffer(args.Env(), buffer.data(), size);
}

napi_value ByteReaderDriver::NotEnded(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<ByteReaderDriver>(args.Env(), args.This());
  if (!driver->mInstance)
    return ThrowError(args.Env(), "Byte reader has no stream");
  return Boolean(args.Env(), driver->mInstance->NotEnded());
}
