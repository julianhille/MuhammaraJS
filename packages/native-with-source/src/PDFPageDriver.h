#pragma once
#include "PDFPage.h"
#include "napi/NapiSupport.h"

#include <memory>
class PageContentContext;
class ConstructorsHolder;
struct OpenContent;
class PDFPageDriver : public muhammara::napi::ObjectWrap {
public:
  PDFPageDriver();
  ~PDFPageDriver() override;
  static bool Init(muhammara::napi::ModuleState &, napi_value);
  PDFPage *GetPage() { return mPDFPage; }
  PageContentContext *ContentContext;
  ConstructorsHolder *holder;
  PDFPage *mPDFPage;
  bool mOwnsPage;
  // The content context started for this page is released by writePage(),
  // which ends this lifecycle.
  DriverLifecycle ContentLifecycle();
  void RenewContentLifecycle();
  void EndContentLifecycle();
  // Set once a writer starts a content context on this page, see OpenContent.
  std::shared_ptr<OpenContent> openContent;

private:
  DriverLifecycle mContentLifecycle;
  static napi_value New(const muhammara::napi::CallbackArgs &);
  static napi_value GetMediaBox(const muhammara::napi::CallbackArgs &);
  static napi_value SetMediaBox(const muhammara::napi::CallbackArgs &);
  static napi_value GetBleedBox(const muhammara::napi::CallbackArgs &);
  static napi_value SetBleedBox(const muhammara::napi::CallbackArgs &);
  static napi_value GetCropBox(const muhammara::napi::CallbackArgs &);
  static napi_value SetCropBox(const muhammara::napi::CallbackArgs &);
  static napi_value GetTrimBox(const muhammara::napi::CallbackArgs &);
  static napi_value SetTrimBox(const muhammara::napi::CallbackArgs &);
  static napi_value GetArtBox(const muhammara::napi::CallbackArgs &);
  static napi_value SetArtBox(const muhammara::napi::CallbackArgs &);
  static napi_value GetRotate(const muhammara::napi::CallbackArgs &);
  static napi_value SetRotate(const muhammara::napi::CallbackArgs &);
  static napi_value
  GetResourcesDictionary(const muhammara::napi::CallbackArgs &);
};
