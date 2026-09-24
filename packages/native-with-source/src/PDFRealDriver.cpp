#include "PDFRealDriver.h"

using namespace muhammara::napi;

bool PDFRealDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFReal", New);
  builder.Accessor("value", GetValue);
  PDFObjectDriver::AddMethods(builder);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFRealDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFRealDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

PDFObject *PDFRealDriver::GetObject() { return TheObject.GetPtr(); }

napi_value PDFRealDriver::GetValue(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<PDFRealDriver>(args.Env(), args.This());
  return Number(args.Env(), driver->TheObject->GetValue());
}
