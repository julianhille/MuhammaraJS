#include "PDFBooleanDriver.h"

using namespace muhammara::napi;

bool PDFBooleanDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFBoolean", New);
  builder.Accessor("value", GetValue);
  PDFObjectDriver::AddMethods(builder);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFBooleanDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFBooleanDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

PDFObject *PDFBooleanDriver::GetObject() { return TheObject.GetPtr(); }

napi_value PDFBooleanDriver::GetValue(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<PDFBooleanDriver>(args.Env(), args.This());
  return Boolean(args.Env(), driver->TheObject->GetValue());
}
