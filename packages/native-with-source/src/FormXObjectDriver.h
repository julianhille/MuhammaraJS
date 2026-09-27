#pragma once

#include "napi/NapiSupport.h"

#include <memory>

class PDFFormXObject;
class PDFWriterDriver;
class ConstructorsHolder;
struct OpenFormXObjects;

class FormXObjectDriver : public muhammara::napi::ObjectWrap {
public:
  FormXObjectDriver();
  ~FormXObjectDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  PDFFormXObject *FormXObject;
  ConstructorsHolder *holder;
  // Set while the form is open, see OpenFormXObjects.
  std::shared_ptr<OpenFormXObjects> openForms;

private:
  PDFWriterDriver *mPDFWriterDriver;
  static napi_value New(const muhammara::napi::CallbackArgs &);
  static napi_value GetID(const muhammara::napi::CallbackArgs &);
  static napi_value GetContentContext(const muhammara::napi::CallbackArgs &);
  static napi_value
  GetResourcesDictionary(const muhammara::napi::CallbackArgs &);
  static napi_value GetContentStream(const muhammara::napi::CallbackArgs &);
};
