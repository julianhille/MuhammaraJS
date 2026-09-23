#include "PDFSymbolDriver.h"

using namespace muhammara::napi;

bool PDFSymbolDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFSymbol", New);
  builder.Accessor("value", GetValue);
  PDFObjectDriver::AddMethods(builder);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFSymbolDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFSymbolDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

PDFObject *PDFSymbolDriver::GetObject() { return TheObject.GetPtr(); }

napi_value PDFSymbolDriver::GetValue(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<PDFSymbolDriver>(args.Env(), args.This());
  return String(args.Env(), driver->TheObject->GetValue());
}
