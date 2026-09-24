#include "PDFDictionaryDriver.h"

#include "ConstructorsHolder.h"
#include "RefCountPtr.h"

using namespace muhammara::napi;

bool PDFDictionaryDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFDictionary", New);
  builder.Method("toJSObject", ToJSObject)
      .Method("queryObject", QueryObject)
      .Method("exists", Exists);
  PDFObjectDriver::AddMethods(builder);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFDictionaryDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFDictionaryDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

PDFObject *PDFDictionaryDriver::GetObject() { return TheObject.GetPtr(); }

napi_value PDFDictionaryDriver::ToJSObject(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<PDFDictionaryDriver>(args.Env(), args.This());
  napi_value result = Object(args.Env());
  MapIterator<PDFNameToPDFObjectMap> iterator =
      driver->TheObject->GetIterator();
  while (iterator.MoveNext()) {
    napi_value value = driver->holder->GetInstanceFor(iterator.GetValue());
    if (!value ||
        !Set(args.Env(), result, iterator.GetKey()->GetValue().c_str(), value))
      return nullptr;
  }
  return result;
}

napi_value PDFDictionaryDriver::Exists(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_string)) {
    return ThrowTypeError(
        args.Env(), "wrong arguments, pass 1 argument which is a string key");
  }
  auto *driver =
      ObjectWrap::Unwrap<PDFDictionaryDriver>(args.Env(), args.This());
  return Boolean(args.Env(),
                 driver->TheObject->Exists(
                     muhammara::napi::LegacyString(args.Env(), args[0])));
}

napi_value PDFDictionaryDriver::QueryObject(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_string)) {
    return ThrowTypeError(
        args.Env(), "wrong arguments, pass 1 argument which is a string key");
  }
  std::string key = muhammara::napi::LegacyString(args.Env(), args[0]);
  auto *driver =
      ObjectWrap::Unwrap<PDFDictionaryDriver>(args.Env(), args.This());
  if (!driver->TheObject->Exists(key)) {
    return ThrowTypeError(args.Env(), "key not found");
  }
  RefCountPtr<PDFObject> object = driver->TheObject->QueryDirectObject(key);
  return driver->holder->GetInstanceFor(object.GetPtr());
}
