#pragma once

#include "napi/NapiSupport.h"

class DictionaryContext;
class ConstructorsHolder;

class DictionaryContextDriver : public muhammara::napi::ObjectWrap {
public:
  DictionaryContextDriver();
  ~DictionaryContextDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);

  DictionaryContext *DictionaryContextInstance;
  ConstructorsHolder *holder;

private:
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value WriteKey(const muhammara::napi::CallbackArgs &args);
  static napi_value WriteNameValue(const muhammara::napi::CallbackArgs &args);
  static napi_value
  WriteRectangleValue(const muhammara::napi::CallbackArgs &args);
  static napi_value
  WriteLiteralStringValue(const muhammara::napi::CallbackArgs &args);
  static napi_value
  WriteBooleanValue(const muhammara::napi::CallbackArgs &args);
  static napi_value
  WriteObjectReferenceValue(const muhammara::napi::CallbackArgs &args);
  static napi_value WriteNumberValue(const muhammara::napi::CallbackArgs &args);
};
