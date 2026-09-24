#include "PDFIndirectObjectReferenceDriver.h"

using namespace muhammara::napi;

bool PDFIndirectObjectReferenceDriver::Init(ModuleState &state,
                                            napi_value exports) {
  ClassBuilder builder(state, "PDFIndirectObjectReference", New);
  builder.Method("getObjectID", GetObjectID).Method("getVersion", GetVersion);
  PDFObjectDriver::AddMethods(builder);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFIndirectObjectReferenceDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFIndirectObjectReferenceDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

PDFObject *PDFIndirectObjectReferenceDriver::GetObject() {
  return TheObject.GetPtr();
}

napi_value
PDFIndirectObjectReferenceDriver::GetObjectID(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<PDFIndirectObjectReferenceDriver>(
      args.Env(), args.This());
  return Number(args.Env(), driver->TheObject->mObjectID);
}

napi_value
PDFIndirectObjectReferenceDriver::GetVersion(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<PDFIndirectObjectReferenceDriver>(
      args.Env(), args.This());
  return Number(args.Env(), driver->TheObject->mVersion);
}
