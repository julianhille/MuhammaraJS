#include "PDFNameDriver.h"

using namespace muhammara::napi;

bool PDFNameDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFName", New);
  builder.Accessor("value", GetValue);
  PDFObjectDriver::AddMethods(builder);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFNameDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFNameDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

PDFObject *PDFNameDriver::GetObject() { return TheObject.GetPtr(); }

napi_value PDFNameDriver::GetValue(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<PDFNameDriver>(args.Env(), args.This());
  return String(args.Env(), driver->TheObject->GetValue());
}
