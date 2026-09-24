#pragma once

#include "napi/NapiSupport.h"

class PDFObjectParser;
class ConstructorsHolder;

class PDFObjectParserDriver : public muhammara::napi::ObjectWrap {
public:
  ~PDFObjectParserDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);

  PDFObjectParser *PDFObjectParserInstance;
  ConstructorsHolder *holder;

private:
  PDFObjectParserDriver();
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value ParseNewObject(const muhammara::napi::CallbackArgs &args);
};
