#pragma once

#include "napi/NapiSupport.h"

class ResourcesDictionary;
class ConstructorsHolder;

class ResourcesDictionaryDriver : public muhammara::napi::ObjectWrap {
public:
  ResourcesDictionaryDriver();
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);

  ResourcesDictionary *ResourcesDictionaryInstance;
  ConstructorsHolder *holder;

private:
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value
  AddFormXObjectMapping(const muhammara::napi::CallbackArgs &args);
  static napi_value
  AddImageXObjectMapping(const muhammara::napi::CallbackArgs &args);
  static napi_value
  AddProcsetResource(const muhammara::napi::CallbackArgs &args);
  static napi_value
  AddExtGStateMapping(const muhammara::napi::CallbackArgs &args);
  static napi_value AddFontMapping(const muhammara::napi::CallbackArgs &args);
  static napi_value
  AddColorSpaceMapping(const muhammara::napi::CallbackArgs &args);
  static napi_value
  AddPatternMapping(const muhammara::napi::CallbackArgs &args);
  static napi_value
  AddPropertyMapping(const muhammara::napi::CallbackArgs &args);
  static napi_value
  AddXObjectMapping(const muhammara::napi::CallbackArgs &args);
  static napi_value
  AddShadingMapping(const muhammara::napi::CallbackArgs &args);
};
