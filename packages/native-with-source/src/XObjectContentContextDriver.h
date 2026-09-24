#pragma once
#include "AbstractContentContextDriver.h"
class XObjectContentContext;
class PDFFormXObject;
class XObjectContentContextDriver : public AbstractContentContextDriver {
public:
  XObjectContentContextDriver();
  static bool Init(muhammara::napi::ModuleState &, napi_value);
  XObjectContentContext *ContentContext;
  PDFFormXObject *FormOfContext;
  AbstractContentContext *GetContext() override;

private:
  static napi_value New(const muhammara::napi::CallbackArgs &);
};
