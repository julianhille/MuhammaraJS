#include "PDFStreamInputDriver.h"

#include "ConstructorsHolder.h"
#include "PDFDictionary.h"
#include "RefCountPtr.h"

using namespace muhammara::napi;

bool PDFStreamInputDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFStreamInput", New);
  builder.Method("getDictionary", GetDictionary)
      .Method("getStreamContentStart", GetStreamContentStart);
  PDFObjectDriver::AddMethods(builder);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFStreamInputDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFStreamInputDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

PDFObject *PDFStreamInputDriver::GetObject() { return TheObject.GetPtr(); }

napi_value PDFStreamInputDriver::GetDictionary(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<PDFStreamInputDriver>(args.Env(), args.This());
  RefCountPtr<PDFDictionary> dictionary =
      driver->TheObject->QueryStreamDictionary();
  return driver->holder->GetInstanceFor(dictionary.GetPtr());
}

napi_value
PDFStreamInputDriver::GetStreamContentStart(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<PDFStreamInputDriver>(args.Env(), args.This());
  return Number(args.Env(), driver->TheObject->GetStreamContentStart());
}
