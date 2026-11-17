#include "ByteReaderDriver.h"

#include "IByteReader.h"

#include <cmath>

using namespace muhammara::napi;

ByteReaderDriver::ByteReaderDriver()
    : mInstance(nullptr), mOwns(false), mReading(std::make_shared<int>(0)) {}

ByteReaderDriver::~ByteReaderDriver() {
  if (mOwns)
    delete mInstance;
}

bool ByteReaderDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "ByteReader", New);
  builder.Method("read", Read)
      .Method("notEnded", NotEnded)
      .Method("dispose", Dispose);
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

ByteReaderDriver *ByteReaderDriver::GetIdleDriver(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<ByteReaderDriver>(args.Env(), args.This());
  // Its read() or notEnded() may call into JavaScript through the PDF
  // reader's stream, whose callback must not use or release the decoders
  // that are running.
  if (IsInCallback(driver->mReading)) {
    ThrowError(args.Env(), "A PDF byte reader cannot be used from a stream "
                           "callback while it is reading");
    return nullptr;
  }
  return driver;
}

napi_value ByteReaderDriver::Read(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_number)) {
    return ThrowTypeError(args.Env(),
                          "Wrong arguments. pass the number of bytes to read");
  }
  auto *driver = GetIdleDriver(args);
  if (!driver)
    return nullptr;
  if (!driver->mInstance)
    return ThrowError(args.Env(), "PDF byte reader has ended");
  double amount = ToDouble(args.Env(), args[0]);
  if (!(amount >= 0 && amount <= 0x7fffffff) || amount != std::floor(amount))
    return ThrowRangeError(args.Env(), "read requires a non-negative integer");
  // As on Wasm, read nothing without asking the decoders: the LZW one writes
  // a byte whatever size it is given.
  if (amount == 0)
    return BytesToBuffer(args.Env(), nullptr, 0);
  std::vector<IOBasicTypes::Byte> buffer(static_cast<size_t>(amount));
  CallbackScope reading(driver->mReading);
  IOBasicTypes::LongBufferSizeType size =
      driver->mInstance->Read(buffer.data(), buffer.size());
  return BytesToBuffer(args.Env(), buffer.data(), size);
}

napi_value ByteReaderDriver::NotEnded(const CallbackArgs &args) {
  auto *driver = GetIdleDriver(args);
  if (!driver)
    return nullptr;
  if (!driver->mInstance)
    return ThrowError(args.Env(), "PDF byte reader has ended");
  CallbackScope reading(driver->mReading);
  return Boolean(args.Env(), driver->mInstance->NotEnded());
}

napi_value ByteReaderDriver::Dispose(const CallbackArgs &args) {
  auto *driver = GetIdleDriver(args);
  if (!driver)
    return nullptr;
  driver->SetStream(nullptr, false);
  return args.This();
}
