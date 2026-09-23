#pragma once

#include "PDFObjectCast.h"
#include "PDFObjectDriver.h"
#include "PDFStreamInput.h"

class PDFStreamInputDriver : public PDFObjectDriver {
public:
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  PDFObject *GetObject() override;

  PDFObjectCastPtr<PDFStreamInput> TheObject;

private:
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value GetDictionary(const muhammara::napi::CallbackArgs &args);
  static napi_value
  GetStreamContentStart(const muhammara::napi::CallbackArgs &args);
};
