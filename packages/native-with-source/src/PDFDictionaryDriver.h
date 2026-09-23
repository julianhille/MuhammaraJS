#pragma once

#include "PDFDictionary.h"
#include "PDFObjectCast.h"
#include "PDFObjectDriver.h"

class PDFDictionaryDriver : public PDFObjectDriver {
public:
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  PDFObject *GetObject() override;

  PDFObjectCastPtr<PDFDictionary> TheObject;

private:
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value ToJSObject(const muhammara::napi::CallbackArgs &args);
  static napi_value QueryObject(const muhammara::napi::CallbackArgs &args);
  static napi_value Exists(const muhammara::napi::CallbackArgs &args);
};
