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
  // Pausing finalizes the current content stream; streams obtained before
  // then throw, and the next one belongs to a new lifecycle.
  void EndCurrentStream();

private:
  DriverLifecycle mCurrentStreamLifecycle;
  static napi_value New(const muhammara::napi::CallbackArgs &);
  static napi_value
  GetCurrentPageContentStream(const muhammara::napi::CallbackArgs &);
  static napi_value GetAssociatedPage(const muhammara::napi::CallbackArgs &);
};
