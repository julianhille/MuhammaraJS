#pragma once
#include "DriverLifecycle.h"
#include "napi/NapiSupport.h"
class PDFDocumentCopyingContext;
class IByteReaderWithPosition;
class ConstructorsHolder;
class DocumentCopyingContextDriver : public muhammara::napi::ObjectWrap {
public:
  DocumentCopyingContextDriver();
  ~DocumentCopyingContextDriver() override;
  static bool Init(muhammara::napi::ModuleState &, napi_value);
  PDFDocumentCopyingContext *CopyingContext;
  IByteReaderWithPosition *ReadStreamProxy;
  ConstructorsHolder *holder;
  bool IsActive();
  DriverLifecycle GetLifecycle();
  void AddOwnerLifecycle(DriverLifecycle);

private:
  DriverLifecycle mLifecycle;
  static napi_value New(const muhammara::napi::CallbackArgs &);
  static napi_value End(const muhammara::napi::CallbackArgs &);
  static napi_value
  CreateFormXObjectFromPDFPage(const muhammara::napi::CallbackArgs &);
  static napi_value MergePDFPageToPage(const muhammara::napi::CallbackArgs &);
  static napi_value AppendPDFPageFromPDF(const muhammara::napi::CallbackArgs &);
  static napi_value
  MergePDFPageToFormXObject(const muhammara::napi::CallbackArgs &);
  static napi_value
  GetSourceDocumentParser(const muhammara::napi::CallbackArgs &);
  static napi_value CopyDirectObjectAsIs(const muhammara::napi::CallbackArgs &);
  static napi_value CopyObject(const muhammara::napi::CallbackArgs &);
  static napi_value
  CopyDirectObjectWithDeepCopy(const muhammara::napi::CallbackArgs &);
  static napi_value
  CopyNewObjectsForDirectObject(const muhammara::napi::CallbackArgs &);
  static napi_value GetCopiedObjectID(const muhammara::napi::CallbackArgs &);
  static napi_value GetCopiedObjects(const muhammara::napi::CallbackArgs &);
  static napi_value ReplaceSourceObjects(const muhammara::napi::CallbackArgs &);
  static napi_value
  GetSourceDocumentStream(const muhammara::napi::CallbackArgs &);
};
