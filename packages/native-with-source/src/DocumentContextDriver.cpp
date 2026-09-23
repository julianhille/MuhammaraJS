#include "DocumentContextDriver.h"

#include "ConstructorsHolder.h"
#include "DocumentContext.h"
#include "InfoDictionaryDriver.h"

using namespace muhammara::napi;

DocumentContextDriver::DocumentContextDriver()
    : DocumentContextInstance(nullptr), holder(nullptr) {}

bool DocumentContextDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "DocumentContext", New);
  builder.Method("getInfoDictionary", GetInfoDictionary);
  return builder.Define(exports, false) != nullptr;
}

napi_value DocumentContextDriver::New(const CallbackArgs &args) {
  auto *driver = new DocumentContextDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

napi_value DocumentContextDriver::GetInfoDictionary(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<DocumentContextDriver>(args.Env(), args.This());
  if (!driver->DocumentContextInstance) {
    return ThrowError(args.Env(),
                      "document context driver not initialized. use the "
                      "pdfwriter to get the current document context");
  }
  napi_value result = driver->holder->New("InfoDictionary");
  InfoDictionaryDriver *info = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), result, &info))
    return nullptr;
  info->InfoDictionaryInstance =
      &driver->DocumentContextInstance->GetTrailerInformation().GetInfo();
  return result;
}
