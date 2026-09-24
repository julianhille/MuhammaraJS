#pragma once

#include "napi/NapiSupport.h"

class PDFObject;
class ConstructorsHolder;

class PDFObjectDriver : public muhammara::napi::ObjectWrap {
public:
  static void AddMethods(muhammara::napi::ClassBuilder &builder);
  virtual PDFObject *GetObject() = 0;

  ConstructorsHolder *holder = nullptr;

private:
  static napi_value GetType(const muhammara::napi::CallbackArgs &args);
  static napi_value
  ToPDFIndirectObjectReference(const muhammara::napi::CallbackArgs &args);
  static napi_value ToPDFArray(const muhammara::napi::CallbackArgs &args);
  static napi_value ToPDFDictionary(const muhammara::napi::CallbackArgs &args);
  static napi_value ToPDFStream(const muhammara::napi::CallbackArgs &args);
  static napi_value ToPDFBoolean(const muhammara::napi::CallbackArgs &args);
  static napi_value
  ToPDFLiteralString(const muhammara::napi::CallbackArgs &args);
  static napi_value ToPDFHexString(const muhammara::napi::CallbackArgs &args);
  static napi_value ToPDFNull(const muhammara::napi::CallbackArgs &args);
  static napi_value ToPDFName(const muhammara::napi::CallbackArgs &args);
  static napi_value ToPDFInteger(const muhammara::napi::CallbackArgs &args);
  static napi_value ToPDFReal(const muhammara::napi::CallbackArgs &args);
  static napi_value ToPDFSymbol(const muhammara::napi::CallbackArgs &args);
  static napi_value ToNumber(const muhammara::napi::CallbackArgs &args);
  static napi_value ToString(const muhammara::napi::CallbackArgs &args);
  static napi_value Convert(const muhammara::napi::CallbackArgs &args,
                            int expectedType);
};
