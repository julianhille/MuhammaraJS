#include "PDFNullDriver.h"

using namespace muhammara::napi;

bool PDFNullDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFNull", New);
  builder.Accessor("value", GetValue);
  PDFObjectDriver::AddMethods(builder);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFNullDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFNullDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

PDFObject *PDFNullDriver::GetObject() { return TheObject.GetPtr(); }

napi_value PDFNullDriver::GetValue(const CallbackArgs &args) {
  return Undefined(args.Env());
}
