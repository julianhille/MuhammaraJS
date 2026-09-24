#pragma once

#include "PDFArray.h"
#include "PDFObjectCast.h"
#include "PDFObjectDriver.h"

class PDFArrayDriver : public PDFObjectDriver {
public:
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  PDFObject *GetObject() override;

  PDFObjectCastPtr<PDFArray> TheObject;

private:
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value ToJSArray(const muhammara::napi::CallbackArgs &args);
  static napi_value QueryObject(const muhammara::napi::CallbackArgs &args);
  static napi_value GetLength(const muhammara::napi::CallbackArgs &args);
};
