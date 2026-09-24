#pragma once
#include "napi/NapiSupport.h"
class PDFModifiedPage;
class PDFWriter;
class ConstructorsHolder;
class PDFPageModifierDriver : public muhammara::napi::ObjectWrap {
public:
  ~PDFPageModifierDriver() override;
  static bool Init(muhammara::napi::ModuleState &, napi_value);
  ConstructorsHolder *holder;

private:
  PDFPageModifierDriver(PDFWriter *, unsigned long, bool = false);
  PDFModifiedPage *mModifierPageInstance;
  static napi_value New(const muhammara::napi::CallbackArgs &);
  static napi_value StartContext(const muhammara::napi::CallbackArgs &);
  static napi_value GetContext(const muhammara::napi::CallbackArgs &);
  static napi_value EndContext(const muhammara::napi::CallbackArgs &);
  static napi_value
  AttachURLLinktoCurrentPage(const muhammara::napi::CallbackArgs &);
  static napi_value WritePage(const muhammara::napi::CallbackArgs &);
};
