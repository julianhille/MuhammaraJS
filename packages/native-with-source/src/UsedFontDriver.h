#pragma once

#include "napi/NapiSupport.h"

class PDFUsedFont;
class ConstructorsHolder;

class UsedFontDriver : public muhammara::napi::ObjectWrap {
public:
  UsedFontDriver();
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);

  PDFUsedFont *UsedFont;
  ConstructorsHolder *holder;

private:
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value
  CalculateTextDimensions(const muhammara::napi::CallbackArgs &args);
  static napi_value GetFontMetrics(const muhammara::napi::CallbackArgs &args);
};
