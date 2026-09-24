#include "PDFLiteralStringDriver.h"

#include "IOBasicTypes.h"
#include "PDFTextString.h"

using namespace muhammara::napi;

bool PDFLiteralStringDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFLiteralString", New);
  builder.Method("toText", ToText)
      .Method("toBytesArray", ToBytesArray)
      .Accessor("value", GetValue);
  PDFObjectDriver::AddMethods(builder);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFLiteralStringDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFLiteralStringDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

PDFObject *PDFLiteralStringDriver::GetObject() { return TheObject.GetPtr(); }

napi_value PDFLiteralStringDriver::GetValue(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<PDFLiteralStringDriver>(args.Env(), args.This());
  return String(args.Env(), driver->TheObject->GetValue());
}

napi_value PDFLiteralStringDriver::ToText(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<PDFLiteralStringDriver>(args.Env(), args.This());
  return String(args.Env(),
                PDFTextString(driver->TheObject->GetValue()).ToUTF8String());
}

napi_value PDFLiteralStringDriver::ToBytesArray(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<PDFLiteralStringDriver>(args.Env(), args.This());
  std::string value = driver->TheObject->GetValue();
  return BytesToArray(args.Env(),
                      reinterpret_cast<const unsigned char *>(value.data()),
                      value.size());
}
