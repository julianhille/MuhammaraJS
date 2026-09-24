#pragma once

#include "napi/NapiSupport.h"

class PDFStream;
class ConstructorsHolder;

class PDFStreamDriver : public muhammara::napi::ObjectWrap {
public:
  ~PDFStreamDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);

  ConstructorsHolder *holder;
  PDFStream *PDFStreamInstance;
  bool mOwns;

private:
  PDFStreamDriver();
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value GetWriteStream(const muhammara::napi::CallbackArgs &args);
};
