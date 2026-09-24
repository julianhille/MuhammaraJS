#pragma once

#include "napi/NapiSupport.h"

class PDFImageXObject;
class ConstructorsHolder;

class ImageXObjectDriver : public muhammara::napi::ObjectWrap {
public:
  ImageXObjectDriver();
  ~ImageXObjectDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);

  PDFImageXObject *ImageXObject;
  ConstructorsHolder *holder;

private:
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value GetID(const muhammara::napi::CallbackArgs &args);
};
