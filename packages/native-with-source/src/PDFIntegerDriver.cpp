#include "PDFIntegerDriver.h"

using namespace muhammara::napi;

bool PDFIntegerDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFInteger", New);
  builder.Accessor("value", GetValue);
  PDFObjectDriver::AddMethods(builder);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFIntegerDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFIntegerDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

PDFObject *PDFIntegerDriver::GetObject() { return TheObject.GetPtr(); }

napi_value PDFIntegerDriver::GetValue(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<PDFIntegerDriver>(args.Env(), args.This());
  return Number(args.Env(), driver->TheObject->GetValue());
}
