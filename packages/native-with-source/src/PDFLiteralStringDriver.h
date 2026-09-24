#pragma once

#include "PDFLiteralString.h"
#include "PDFObjectCast.h"
#include "PDFObjectDriver.h"

class PDFLiteralStringDriver : public PDFObjectDriver {
public:
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  PDFObject *GetObject() override;
  PDFObjectCastPtr<PDFLiteralString> TheObject;

private:
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value GetValue(const muhammara::napi::CallbackArgs &args);
  static napi_value ToText(const muhammara::napi::CallbackArgs &args);
  static napi_value ToBytesArray(const muhammara::napi::CallbackArgs &args);
};
