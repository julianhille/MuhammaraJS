#pragma once

#include "PDFDate.h"
#include "napi/NapiSupport.h"

class PDFDateDriver : public muhammara::napi::ObjectWrap {
public:
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  PDFDate *getInstance();

private:
  PDFDate mDate;

  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value ToString(const muhammara::napi::CallbackArgs &args);
  static napi_value SetToCurrentTime(const muhammara::napi::CallbackArgs &args);
  static int GetIntValueFromDateFunction(napi_env env, napi_value date,
                                         const char *functionName);
  static unsigned int GetUIntValueFromDateFunction(napi_env env,
                                                   napi_value date,
                                                   const char *functionName);
};
