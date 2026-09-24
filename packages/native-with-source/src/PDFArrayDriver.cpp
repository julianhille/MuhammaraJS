#include "PDFArrayDriver.h"

#include "ConstructorsHolder.h"
#include "RefCountPtr.h"

using namespace muhammara::napi;

bool PDFArrayDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFArray", New);
  builder.Method("toJSArray", ToJSArray)
      .Method("queryObject", QueryObject)
      .Method("getLength", GetLength);
  PDFObjectDriver::AddMethods(builder);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFArrayDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFArrayDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

PDFObject *PDFArrayDriver::GetObject() { return TheObject.GetPtr(); }

napi_value PDFArrayDriver::ToJSArray(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<PDFArrayDriver>(args.Env(), args.This());
  napi_value result = Array(args.Env(), driver->TheObject->GetLength());
  for (unsigned long i = 0; i < driver->TheObject->GetLength(); ++i) {
    RefCountPtr<PDFObject> object(driver->TheObject->QueryObject(i));
    napi_value value = driver->holder->GetInstanceFor(object.GetPtr());
    if (!value || !Set(args.Env(), result, i, value))
      return nullptr;
  }
  return result;
}

napi_value PDFArrayDriver::GetLength(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<PDFArrayDriver>(args.Env(), args.This());
  return Number(args.Env(), driver->TheObject->GetLength());
}

napi_value PDFArrayDriver::QueryObject(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_number)) {
    return ThrowTypeError(
        args.Env(),
        "wrong arguments, pass 1 argument which is an index in the array");
  }
  auto *driver = ObjectWrap::Unwrap<PDFArrayDriver>(args.Env(), args.This());
  uint32_t index = ToUint32(args.Env(), args[0]);
  if (index >= driver->TheObject->GetLength()) {
    return ThrowTypeError(
        args.Env(),
        "wrong arguments, pass 1 argument which is a valid index in the array");
  }
  RefCountPtr<PDFObject> object(driver->TheObject->QueryObject(index));
  return driver->holder->GetInstanceFor(object.GetPtr());
}
