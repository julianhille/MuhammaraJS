#include "PDFObjectParserDriver.h"

#include "ConstructorsHolder.h"
#include "PDFObject.h"
#include "PDFObjectParser.h"
#include "RefCountPtr.h"

using namespace muhammara::napi;

PDFObjectParserDriver::PDFObjectParserDriver()
    : PDFObjectParserInstance(nullptr), holder(nullptr) {}
PDFObjectParserDriver::~PDFObjectParserDriver() {
  delete PDFObjectParserInstance;
}

bool PDFObjectParserDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFObjectParserDriver", New);
  builder.Method("parseNewObject", ParseNewObject);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFObjectParserDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFObjectParserDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

napi_value PDFObjectParserDriver::ParseNewObject(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<PDFObjectParserDriver>(args.Env(), args.This());
  RefCountPtr<PDFObject> object =
      driver->PDFObjectParserInstance->ParseNewObject();
  return object.GetPtr() ? driver->holder->GetInstanceFor(object.GetPtr())
                         : Undefined(args.Env());
}
