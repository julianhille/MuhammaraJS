#pragma once

#include "napi/NapiSupport.h"

namespace PDFHummus {
class DocumentContext;
}
class ConstructorsHolder;

class DocumentContextDriver : public muhammara::napi::ObjectWrap {
public:
  DocumentContextDriver();
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);

  PDFHummus::DocumentContext *DocumentContextInstance;
  ConstructorsHolder *holder;

private:
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value
  GetInfoDictionary(const muhammara::napi::CallbackArgs &args);
};
