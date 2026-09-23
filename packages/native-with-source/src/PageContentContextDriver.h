#pragma once
#include "AbstractContentContextDriver.h"
class PageContentContext;
class PageContentContextDriver : public AbstractContentContextDriver {
public:
  PageContentContextDriver();
  ~PageContentContextDriver() override;
  static bool Init(muhammara::napi::ModuleState &, napi_value);
  PageContentContext *ContentContext;
  AbstractContentContext *GetContext() override;

private:
  static napi_value New(const muhammara::napi::CallbackArgs &);
  static napi_value
  GetCurrentPageContentStream(const muhammara::napi::CallbackArgs &);
  static napi_value GetAssociatedPage(const muhammara::napi::CallbackArgs &);
};
