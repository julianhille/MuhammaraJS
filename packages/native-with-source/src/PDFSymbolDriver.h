#pragma once

#include "PDFObjectCast.h"
#include "PDFObjectDriver.h"
#include "PDFSymbol.h"

class PDFSymbolDriver : public PDFObjectDriver {
public:
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  PDFObject *GetObject() override;
  PDFObjectCastPtr<PDFSymbol> TheObject;

private:
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value GetValue(const muhammara::napi::CallbackArgs &args);
};
