#pragma once

#include "PDFTextString.h"
#include "napi/NapiSupport.h"

class PDFTextStringDriver : public muhammara::napi::ObjectWrap {
public:
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);

private:
  PDFTextString mTextString;

  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value ToBytesArray(const muhammara::napi::CallbackArgs &args);
  static napi_value ToString(const muhammara::napi::CallbackArgs &args);
  static napi_value FromString(const muhammara::napi::CallbackArgs &args);
};
