#include "DictionaryContextDriver.h"

#include "DictionaryContext.h"
#include "PDFRectangle.h"

using namespace muhammara::napi;

namespace {
DictionaryContextDriver *GetDriver(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<DictionaryContextDriver>(args.Env(), args.This());
  if (!driver->DictionaryContextInstance) {
    ThrowError(args.Env(), "dictinoarycontext object not initialized, create "
                           "using objectscontext.startDictionary");
    return nullptr;
  }
  return driver;
}

bool StringOrBytes(const CallbackArgs &args, napi_value value,
                   std::string &out) {
  return muhammara::napi::StringOrBytes(args.Env(), value, out);
}
} // namespace

DictionaryContextDriver::DictionaryContextDriver()
    : DictionaryContextInstance(nullptr), holder(nullptr) {}
DictionaryContextDriver::~DictionaryContextDriver() = default;

bool DictionaryContextDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "DictionaryContext", New);
  builder.Method("writeKey", WriteKey)
      .Method("writeNameValue", WriteNameValue)
      .Method("writeRectangleValue", WriteRectangleValue)
      .Method("writeLiteralStringValue", WriteLiteralStringValue)
      .Method("writeBooleanValue", WriteBooleanValue)
      .Method("writeObjectReferenceValue", WriteObjectReferenceValue)
      .Method("writeNumberValue", WriteNumberValue);
  return builder.Define(exports, false) != nullptr;
}

napi_value DictionaryContextDriver::New(const CallbackArgs &args) {
  auto *driver = new DictionaryContextDriver();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

napi_value DictionaryContextDriver::WriteKey(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_string))
    return ThrowError(args.Env(), "Wrong arguments, provide a string to write");
  auto *driver = GetDriver(args);
  if (!driver)
    return nullptr;
  driver->DictionaryContextInstance->WriteKey(
      LegacyString(args.Env(), args[0]));
  return args.This();
}

napi_value DictionaryContextDriver::WriteNameValue(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_string))
    return ThrowError(args.Env(), "Wrong arguments, provide a string to write");
  auto *driver = GetDriver(args);
  if (!driver)
    return nullptr;
  driver->DictionaryContextInstance->WriteNameValue(
      LegacyString(args.Env(), args[0]));
  return args.This();
}

napi_value
DictionaryContextDriver::WriteRectangleValue(const CallbackArgs &args) {
  bool arrayForm = args.Length() == 1 && IsArray(args.Env(), args[0]);
  bool numberForm = args.Length() == 4;
  for (size_t i = 0; numberForm && i < 4; ++i)
    numberForm = IsType(args.Env(), args[i], napi_number);
  uint32_t length = 0;
  if (arrayForm && !Length(args.Env(), args[0], &length))
    return nullptr;
  if ((!arrayForm && !numberForm) || (arrayForm && length != 4))
    return ThrowError(
        args.Env(),
        "Wrong arguments, provide an array of 4 numbers, or 4 numbers");
  auto *driver = GetDriver(args);
  if (!driver)
    return nullptr;
  double values[4];
  if (arrayForm) {
    if (!ReadNumberArray(args.Env(), args[0], values))
      return nullptr;
  } else {
    for (uint32_t i = 0; i < 4; ++i)
      values[i] = ToDouble(args.Env(), args[i]);
  }
  driver->DictionaryContextInstance->WriteRectangleValue(
      PDFRectangle(values[0], values[1], values[2], values[3]));
  return args.This();
}

napi_value
DictionaryContextDriver::WriteLiteralStringValue(const CallbackArgs &args) {
  if (args.Length() != 1 || (!IsType(args.Env(), args[0], napi_string) &&
                             !IsArray(args.Env(), args[0])))
    return ThrowError(args.Env(), "wrong arguments, pass 1 argument that is a "
                                  "literal string (string) or an array");
  auto *driver = GetDriver(args);
  if (!driver)
    return nullptr;
  std::string value;
  if (!StringOrBytes(args, args[0], value))
    return nullptr;
  driver->DictionaryContextInstance->WriteLiteralStringValue(value);
  return args.This();
}

napi_value
DictionaryContextDriver::WriteBooleanValue(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_boolean))
    return ThrowError(args.Env(),
                      "Wrong arguments, provide a boolean to write");
  auto *driver = GetDriver(args);
  if (!driver)
    return nullptr;
  driver->DictionaryContextInstance->WriteBooleanValue(
      ToBoolean(args.Env(), args[0]));
  return args.This();
}

napi_value
DictionaryContextDriver::WriteObjectReferenceValue(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_number))
    return ThrowError(args.Env(),
                      "Wrong arguments, provide an object id to write");
  auto *driver = GetDriver(args);
  if (!driver)
    return nullptr;
  driver->DictionaryContextInstance->WriteObjectReferenceValue(
      ToUint32(args.Env(), args[0]));
  return args.This();
}

napi_value DictionaryContextDriver::WriteNumberValue(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_number))
    return ThrowError(args.Env(), "Wrong arguments, provide a number to write");
  auto *driver = GetDriver(args);
  if (!driver)
    return nullptr;
  double value = ToDouble(args.Env(), args[0]);
  int32_t signedValue = ToInt32(args.Env(), args[0]);
  uint32_t unsignedValue = ToUint32(args.Env(), args[0]);
  if (value == unsignedValue)
    driver->DictionaryContextInstance->WriteIntegerValue(unsignedValue);
  else if (value == signedValue)
    driver->DictionaryContextInstance->WriteIntegerValue(signedValue);
  else
    driver->DictionaryContextInstance->WriteDoubleValue(value);
  return args.This();
}
