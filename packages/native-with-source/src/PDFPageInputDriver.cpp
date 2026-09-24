#include "PDFPageInputDriver.h"

#include "ConstructorsHolder.h"
#include "PDFPageInput.h"

using namespace muhammara::napi;

PDFPageInputDriver::PDFPageInputDriver()
    : PageInput(nullptr), holder(nullptr) {}
PDFPageInputDriver::~PDFPageInputDriver() { delete PageInput; }

bool PDFPageInputDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFPageInput", New);
  builder.Method("getDictionary", GetDictionary)
      .Method("getMediaBox", GetMediaBox)
      .Method("getCropBox", GetCropBox)
      .Method("getTrimBox", GetTrimBox)
      .Method("getBleedBox", GetBleedBox)
      .Method("getArtBox", GetArtBox)
      .Method("getRotate", GetRotate);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFPageInputDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFPageInputDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

PDFPageInputDriver *PDFPageInputDriver::GetPage(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<PDFPageInputDriver>(args.Env(), args.This());
  if (!driver->PageInput) {
    ThrowTypeError(
        args.Env(),
        "page input not initialized. create one using the PDFReader.parsePage");
    return nullptr;
  }
  return driver;
}

napi_value PDFPageInputDriver::GetDictionary(const CallbackArgs &args) {
  auto *driver = GetPage(args);
  return driver ? driver->holder->GetInstanceFor(
                      driver->PageInputDictionary.GetPtr())
                : nullptr;
}

napi_value
PDFPageInputDriver::GetArrayForPDFRectangle(napi_env env,
                                            const PDFRectangle &rectangle) {
  napi_value result = Array(env, 4);
  Set(env, result, uint32_t{0}, Number(env, rectangle.LowerLeftX));
  Set(env, result, uint32_t{1}, Number(env, rectangle.LowerLeftY));
  Set(env, result, uint32_t{2}, Number(env, rectangle.UpperRightX));
  Set(env, result, uint32_t{3}, Number(env, rectangle.UpperRightY));
  return result;
}

#define RECTANGLE_METHOD(Name, Getter)                                         \
  napi_value PDFPageInputDriver::Name(const CallbackArgs &args) {              \
    auto *driver = GetPage(args);                                              \
    return driver ? GetArrayForPDFRectangle(args.Env(),                        \
                                            driver->PageInput->Getter())       \
                  : nullptr;                                                   \
  }

RECTANGLE_METHOD(GetMediaBox, GetMediaBox)
RECTANGLE_METHOD(GetCropBox, GetCropBox)
RECTANGLE_METHOD(GetTrimBox, GetTrimBox)
RECTANGLE_METHOD(GetBleedBox, GetBleedBox)
RECTANGLE_METHOD(GetArtBox, GetArtBox)
#undef RECTANGLE_METHOD

napi_value PDFPageInputDriver::GetRotate(const CallbackArgs &args) {
  auto *driver = GetPage(args);
  return driver ? Number(args.Env(), driver->PageInput->GetRotate()) : nullptr;
}
