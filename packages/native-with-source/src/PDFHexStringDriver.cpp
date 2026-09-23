#include "PDFHexStringDriver.h"

#include "IOBasicTypes.h"
#include "PDFTextString.h"

using namespace muhammara::napi;

bool PDFHexStringDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFHexString", New);
  builder.Method("toText", ToText)
      .Method("toBytesArray", ToBytesArray)
      .Accessor("value", GetValue);
  PDFObjectDriver::AddMethods(builder);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFHexStringDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFHexStringDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

PDFObject *PDFHexStringDriver::GetObject() { return TheObject.GetPtr(); }

napi_value PDFHexStringDriver::GetValue(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<PDFHexStringDriver>(args.Env(), args.This());
  return String(args.Env(), driver->TheObject->GetValue());
}

napi_value PDFHexStringDriver::ToText(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<PDFHexStringDriver>(args.Env(), args.This());
  return String(args.Env(),
                PDFTextString(driver->TheObject->GetValue()).ToUTF8String());
}

napi_value PDFHexStringDriver::ToBytesArray(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<PDFHexStringDriver>(args.Env(), args.This());
  std::string value = driver->TheObject->GetValue();
  return BytesToArray(args.Env(),
                      reinterpret_cast<const unsigned char *>(value.data()),
                      value.size());
}
