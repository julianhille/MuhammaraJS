#pragma once

#include "napi/NapiSupport.h"

class PDFFormXObject;
class PDFWriterDriver;
class ConstructorsHolder;

class FormXObjectDriver : public muhammara::napi::ObjectWrap {
public:
  FormXObjectDriver();
  ~FormXObjectDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  PDFFormXObject *FormXObject;
  ConstructorsHolder *holder;

private:
  PDFWriterDriver *mPDFWriterDriver;
  static napi_value New(const muhammara::napi::CallbackArgs &);
  static napi_value GetID(const muhammara::napi::CallbackArgs &);
  static napi_value GetContentContext(const muhammara::napi::CallbackArgs &);
  static napi_value
  GetResourcesDictionary(const muhammara::napi::CallbackArgs &);
  static napi_value GetContentStream(const muhammara::napi::CallbackArgs &);
};
