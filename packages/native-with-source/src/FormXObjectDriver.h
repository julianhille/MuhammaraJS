#pragma once

#include "napi/NapiSupport.h"

#include <memory>

class PDFFormXObject;
class PDFWriterDriver;
class ConstructorsHolder;
struct OpenContent;

class FormXObjectDriver : public muhammara::napi::ObjectWrap {
public:
  FormXObjectDriver();
  ~FormXObjectDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  PDFFormXObject *FormXObject;
  ConstructorsHolder *holder;
  // Set while the form is open, see OpenContent.
  std::shared_ptr<OpenContent> openContent;
  // Records the writer that started the form, whose endFormXObject() alone
  // may end it.
  void SetOpenIn(PDFWriterDriver *writer);
  bool IsOpenIn(PDFWriterDriver *writer) const;
  // Ends the form's content, after which its content objects throw.
  void EndContent();

private:
  PDFWriterDriver *mPDFWriterDriver;
  DriverLifecycle mContentLifecycle;
  static napi_value New(const muhammara::napi::CallbackArgs &);
  static napi_value GetID(const muhammara::napi::CallbackArgs &);
  static napi_value GetContentContext(const muhammara::napi::CallbackArgs &);
  static napi_value
  GetResourcesDictionary(const muhammara::napi::CallbackArgs &);
  static napi_value GetContentStream(const muhammara::napi::CallbackArgs &);
};
