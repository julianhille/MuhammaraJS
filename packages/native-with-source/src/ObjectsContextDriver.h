#pragma once

#include "napi/NapiSupport.h"

class ObjectsContext;
class ConstructorsHolder;

class ObjectsContextDriver : public muhammara::napi::ObjectWrap {
public:
  ObjectsContextDriver();
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  ObjectsContext *ObjectsContextInstance;
  ConstructorsHolder *holder;

private:
  static napi_value New(const muhammara::napi::CallbackArgs &);
  static napi_value AllocateNewObjectID(const muhammara::napi::CallbackArgs &);
  static napi_value StartDictionary(const muhammara::napi::CallbackArgs &);
  static napi_value StartArray(const muhammara::napi::CallbackArgs &);
  static napi_value WriteNumber(const muhammara::napi::CallbackArgs &);
  static napi_value EndArray(const muhammara::napi::CallbackArgs &);
  static napi_value EndLine(const muhammara::napi::CallbackArgs &);
  static napi_value EndDictionary(const muhammara::napi::CallbackArgs &);
  static napi_value EndIndirectObject(const muhammara::napi::CallbackArgs &);
  static napi_value
  WriteIndirectObjectReference(const muhammara::napi::CallbackArgs &);
  static napi_value
  StartNewIndirectObject(const muhammara::napi::CallbackArgs &);
  static napi_value
  StartModifiedIndirectObject(const muhammara::napi::CallbackArgs &);
  static napi_value DeleteObject(const muhammara::napi::CallbackArgs &);
  static napi_value WriteName(const muhammara::napi::CallbackArgs &);
  static napi_value WriteLiteralString(const muhammara::napi::CallbackArgs &);
  static napi_value WriteHexString(const muhammara::napi::CallbackArgs &);
  static napi_value WriteBoolean(const muhammara::napi::CallbackArgs &);
  static napi_value WriteKeyword(const muhammara::napi::CallbackArgs &);
  static napi_value WriteComment(const muhammara::napi::CallbackArgs &);
  static napi_value SetCompressStreams(const muhammara::napi::CallbackArgs &);
  static napi_value StartPDFStream(const muhammara::napi::CallbackArgs &);
  static napi_value
  StartUnfilteredPDFStream(const muhammara::napi::CallbackArgs &);
  static napi_value EndPDFStream(const muhammara::napi::CallbackArgs &);
  static napi_value StartFreeContext(const muhammara::napi::CallbackArgs &);
  static napi_value EndFreeContext(const muhammara::napi::CallbackArgs &);
};
