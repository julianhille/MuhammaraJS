#pragma once

#include "PDFDictionary.h"
#include "PDFObjectCast.h"
#include "PDFRectangle.h"
#include "napi/NapiSupport.h"

class PDFPageInput;
class ConstructorsHolder;

class PDFPageInputDriver : public muhammara::napi::ObjectWrap {
public:
  PDFPageInputDriver();
  ~PDFPageInputDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);

  PDFPageInput *PageInput;
  PDFObjectCastPtr<PDFDictionary> PageInputDictionary;
  ConstructorsHolder *holder;

private:
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value GetDictionary(const muhammara::napi::CallbackArgs &args);
  static napi_value GetMediaBox(const muhammara::napi::CallbackArgs &args);
  static napi_value GetCropBox(const muhammara::napi::CallbackArgs &args);
  static napi_value GetTrimBox(const muhammara::napi::CallbackArgs &args);
  static napi_value GetBleedBox(const muhammara::napi::CallbackArgs &args);
  static napi_value GetArtBox(const muhammara::napi::CallbackArgs &args);
  static napi_value GetRotate(const muhammara::napi::CallbackArgs &args);
  static napi_value GetArrayForPDFRectangle(napi_env env,
                                            const PDFRectangle &rectangle);
  static PDFPageInputDriver *GetPage(const muhammara::napi::CallbackArgs &args);
};
