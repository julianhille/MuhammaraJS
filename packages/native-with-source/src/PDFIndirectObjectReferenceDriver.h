#pragma once

#include "PDFIndirectObjectReference.h"
#include "PDFObjectCast.h"
#include "PDFObjectDriver.h"

class PDFIndirectObjectReferenceDriver : public PDFObjectDriver {
public:
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  PDFObject *GetObject() override;
  PDFObjectCastPtr<PDFIndirectObjectReference> TheObject;

private:
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value GetObjectID(const muhammara::napi::CallbackArgs &args);
  static napi_value GetVersion(const muhammara::napi::CallbackArgs &args);
};
