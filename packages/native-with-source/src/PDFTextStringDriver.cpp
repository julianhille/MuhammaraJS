#include "PDFTextStringDriver.h"

#include "IOBasicTypes.h"

using namespace muhammara::napi;

bool PDFTextStringDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFTextString", New);
  builder.Method("toBytesArray", ToBytesArray)
      .Method("toString", ToString)
      .Method("fromString", FromString);
  return builder.Define(exports) != nullptr;
}

napi_value PDFTextStringDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFTextStringDriver();
  if (args.Length() > 0) {
    if (IsType(args.Env(), args[0], napi_string)) {
      driver->mTextString.FromUTF8(
          muhammara::napi::LegacyString(args.Env(), args[0]));
    } else if (IsArray(args.Env(), args[0])) {
      uint32_t length = 0;
      if (!Length(args.Env(), args[0], &length)) {
        delete driver;
        return nullptr;
      }
      std::string buffer;
      buffer.reserve(length);
      for (uint32_t i = 0; i < length; ++i) {
        napi_value value = nullptr;
        uint32_t byte = 0;
        if (!Get(args.Env(), args[0], i, &value) ||
            !CoerceToUint32(args.Env(), value, &byte)) {
          delete driver;
          return nullptr;
        }
        buffer.push_back(static_cast<char>(byte));
      }
      driver->mTextString = buffer;
    }
  }
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

napi_value PDFTextStringDriver::ToBytesArray(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<PDFTextStringDriver>(args.Env(), args.This());
  std::string value = driver->mTextString.ToString();
  return BytesToArray(args.Env(),
                      reinterpret_cast<const unsigned char *>(value.data()),
                      value.size());
}

napi_value PDFTextStringDriver::ToString(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<PDFTextStringDriver>(args.Env(), args.This());
  return String(args.Env(), driver->mTextString.ToUTF8String());
}

napi_value PDFTextStringDriver::FromString(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<PDFTextStringDriver>(args.Env(), args.This());
  if (args.Length() > 0 && IsType(args.Env(), args[0], napi_string)) {
    driver->mTextString.FromUTF8(
        muhammara::napi::LegacyString(args.Env(), args[0]));
  }
  return args.This();
}
