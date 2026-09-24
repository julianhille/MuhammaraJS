#pragma once

#include "napi/NapiSupport.h"

class InfoDictionary;

class InfoDictionaryDriver : public muhammara::napi::ObjectWrap {
public:
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  InfoDictionary *InfoDictionaryInstance;
  ConstructorsHolder *holder;

private:
  InfoDictionaryDriver();
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value GetText(const muhammara::napi::CallbackArgs &args);
  static napi_value SetText(const muhammara::napi::CallbackArgs &args);
  static napi_value GetTrapped(const muhammara::napi::CallbackArgs &args);
  static napi_value SetTrapped(const muhammara::napi::CallbackArgs &args);
  static napi_value SetCreationDate(const muhammara::napi::CallbackArgs &args);
  static napi_value SetModDate(const muhammara::napi::CallbackArgs &args);
  static napi_value
  AddAdditionalInfoEntry(const muhammara::napi::CallbackArgs &args);
  static napi_value
  RemoveAdditionalInfoEntry(const muhammara::napi::CallbackArgs &args);
  static napi_value
  ClearAdditionalInfoEntries(const muhammara::napi::CallbackArgs &args);
  static napi_value
  GetAdditionalInfoEntry(const muhammara::napi::CallbackArgs &args);
  static napi_value
  GetAdditionalInfoEntries(const muhammara::napi::CallbackArgs &args);
};
