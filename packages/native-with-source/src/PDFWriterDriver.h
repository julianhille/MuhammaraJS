#pragma once

#include "ObjectsBasicTypes.h"

#include "DriverLifecycle.h"
#include "EHummusImageType.h"
#include "ObjectByteReaderWithPosition.h"
#include "ObjectByteWriter.h"
#include "ObjectByteWriterWithPosition.h"
#include "PDFEmbedParameterTypes.h"
#include "IDocumentContextExtender.h"
#include "PDFWriter.h"
#include "napi/NapiSupport.h"

#include <memory>
#include <set>

class ConstructorsHolder;
class PDFFormXObject;
class PDFWriterDriver;

// Forms started with createFormXObject() and not yet ended. Their content
// stream writes to the writer's output and deletes it when destroyed
// unfinished, so it must be finalized while that output is alive. Shared by
// the writer and its forms because their finalizers run in any order.
struct OpenFormXObjects {
  PDFWriterDriver *writer = nullptr;
  std::set<PDFFormXObject *> forms;
};

class PDFWriterDriver : public muhammara::napi::ObjectWrap,
                        public IDocumentContextExtender {
public:
  ~PDFWriterDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  PDFHummus::EStatusCode StartPDF(const std::string &, EPDFVersion,
                                  const LogConfiguration &,
                                  const PDFCreationSettings &);
  PDFHummus::EStatusCode StartPDF(napi_env, napi_value, EPDFVersion,
                                  const LogConfiguration &,
                                  const PDFCreationSettings &);
  PDFHummus::EStatusCode ContinuePDF(const std::string &, const std::string &,
                                     const std::string &,
                                     const LogConfiguration &);
  PDFHummus::EStatusCode ContinuePDF(napi_env, napi_value, const std::string &,
                                     napi_value, const LogConfiguration &);
  PDFHummus::EStatusCode ModifyPDF(const std::string &, EPDFVersion,
                                   const std::string &,
                                   const LogConfiguration &,
                                   const PDFCreationSettings &);
  PDFHummus::EStatusCode ModifyPDF(napi_env, napi_value, napi_value,
                                   EPDFVersion, const LogConfiguration &,
                                   const PDFCreationSettings &);
  PDFWriter *GetWriter();
  // Detaches an open form's stream from the output from a finalizer, which
  // leaves the PDF incomplete, so end() fails.
  void AbandonFormXObject(PDFFormXObject *);
  // Ends when the writer ends; objects that use the writer's state depend on it.
  DriverLifecycle GetLifecycle();
  void SetLogStream(napi_env env, napi_value stream, LogConfiguration &config);
  ConstructorsHolder *holder;

  PDFHummus::EStatusCode OnPageWrite(PDFPage *, DictionaryContext *,
                                     ObjectsContext *,
                                     PDFHummus::DocumentContext *) override;
  PDFHummus::EStatusCode
  OnResourcesWrite(ResourcesDictionary *, DictionaryContext *, ObjectsContext *,
                   PDFHummus::DocumentContext *) override;
  PDFHummus::EStatusCode
  OnResourceDictionaryWrite(DictionaryContext *, const std::string &,
                            ObjectsContext *,
                            PDFHummus::DocumentContext *) override;
  PDFHummus::EStatusCode
  OnFormXObjectWrite(ObjectIDType, ObjectIDType, DictionaryContext *,
                     ObjectsContext *, PDFHummus::DocumentContext *) override;
  PDFHummus::EStatusCode OnJPEGImageXObjectWrite(ObjectIDType,
                                                 DictionaryContext *,
                                                 ObjectsContext *,
                                                 PDFHummus::DocumentContext *,
                                                 JPEGImageHandler *) override;
  PDFHummus::EStatusCode OnTIFFImageXObjectWrite(ObjectIDType,
                                                 DictionaryContext *,
                                                 ObjectsContext *,
                                                 PDFHummus::DocumentContext *,
                                                 TIFFImageHandler *) override;
  PDFHummus::EStatusCode OnCatalogWrite(CatalogInformation *,
                                        DictionaryContext *, ObjectsContext *,
                                        PDFHummus::DocumentContext *) override;
  PDFHummus::EStatusCode OnPDFParsingComplete(ObjectsContext *,
                                              PDFHummus::DocumentContext *,
                                              PDFDocumentHandler *) override;
  PDFHummus::EStatusCode
  OnBeforeCreateXObjectFromPage(PDFDictionary *, ObjectsContext *,
                                PDFHummus::DocumentContext *,
                                PDFDocumentHandler *) override;
  PDFHummus::EStatusCode
  OnAfterCreateXObjectFromPage(PDFFormXObject *, PDFDictionary *,
                               ObjectsContext *, PDFHummus::DocumentContext *,
                               PDFDocumentHandler *) override;
  PDFHummus::EStatusCode
  OnBeforeCreatePageFromPage(PDFDictionary *, ObjectsContext *,
                             PDFHummus::DocumentContext *,
                             PDFDocumentHandler *) override;
  PDFHummus::EStatusCode
  OnAfterCreatePageFromPage(PDFPage *, PDFDictionary *, ObjectsContext *,
                            PDFHummus::DocumentContext *,
                            PDFDocumentHandler *) override;
  PDFHummus::EStatusCode
  OnBeforeMergePageFromPage(PDFPage *, PDFDictionary *, ObjectsContext *,
                            PDFHummus::DocumentContext *,
                            PDFDocumentHandler *) override;
  PDFHummus::EStatusCode
  OnAfterMergePageFromPage(PDFPage *, PDFDictionary *, ObjectsContext *,
                           PDFHummus::DocumentContext *,
                           PDFDocumentHandler *) override;
  PDFHummus::EStatusCode OnPDFCopyingComplete(ObjectsContext *,
                                              PDFHummus::DocumentContext *,
                                              PDFDocumentHandler *) override;
  bool IsCatalogUpdateRequiredForModifiedFile(PDFParser *) override;

private:
  PDFWriterDriver();
  static napi_value New(const muhammara::napi::CallbackArgs &);
  template <napi_value (*Method)(const muhammara::napi::CallbackArgs &)>
  static napi_value Active(const muhammara::napi::CallbackArgs &);
  static napi_value End(const muhammara::napi::CallbackArgs &);
  static napi_value Abort(const muhammara::napi::CallbackArgs &);
#define DECLARE_METHOD(name)                                                   \
  static napi_value name(const muhammara::napi::CallbackArgs &)
  DECLARE_METHOD(CreatePage);
  DECLARE_METHOD(WritePage);
  DECLARE_METHOD(WritePageAndReturnID);
  DECLARE_METHOD(StartPageContentContext);
  DECLARE_METHOD(PausePageContentContext);
  DECLARE_METHOD(CreateFormXObject);
  DECLARE_METHOD(EndFormXObject);
  DECLARE_METHOD(CreateformXObjectFromJPG);
  DECLARE_METHOD(RetrieveJPGImageInformation);
  DECLARE_METHOD(CreateFormXObjectFromPNG);
  DECLARE_METHOD(GetFontForFile);
  DECLARE_METHOD(AttachURLLinktoCurrentPage);
  DECLARE_METHOD(Shutdown);
  DECLARE_METHOD(CreateFormXObjectFromTIFF);
  DECLARE_METHOD(CreateImageXObjectFromJPG);
  DECLARE_METHOD(GetObjectsContext);
  DECLARE_METHOD(GetDocumentContext);
  DECLARE_METHOD(AppendPDFPagesFromPDF);
  DECLARE_METHOD(MergePDFPagesToPage);
  DECLARE_METHOD(CreatePDFCopyingContext);
  DECLARE_METHOD(CreateFormXObjectsFromPDF);
  DECLARE_METHOD(CreatePDFCopyingContextForModifiedFile);
  DECLARE_METHOD(CreatePDFTextString);
  DECLARE_METHOD(CreatePDFDate);
  DECLARE_METHOD(GetImageDimensions);
  DECLARE_METHOD(GetImagePagesCount);
  DECLARE_METHOD(GetImageType);
  DECLARE_METHOD(GetModifiedFileParser);
  DECLARE_METHOD(GetModifiedInputFile);
  DECLARE_METHOD(GetOutputFile);
  DECLARE_METHOD(RegisterAnnotationReferenceForNextPageWrite);
  DECLARE_METHOD(RequireCatalogUpdate);
#undef DECLARE_METHOD
  static bool ColorFromArray(napi_env, napi_value, CMYKRGBColor &);
  static bool ObjectToPageRange(napi_env, napi_value, PDFPageRange &);
  PDFHummus::EStatusCode Setup(PDFHummus::EStatusCode);
  PDFHummus::EStatusCode TriggerEvent(const std::string &, napi_value);
  // Returns false when buffered output could not be delivered.
  bool Retire();
  void ReleaseOpenFormXObjects();
  void ReleaseLogProxy();
  bool startedWithStream_;
  bool catalogUpdateRequired_;
  bool started_;
  bool formAbandoned_;
  DriverLifecycle lifecycle_;
  std::shared_ptr<OpenFormXObjects> openForms_;
  PDFWriter writer_;
  ObjectByteWriterWithPosition *writeProxy_;
  ObjectByteReaderWithPosition *readProxy_;
  ObjectByteWriter *logProxy_;
  napi_env env_;
  muhammara::napi::Reference self_;
};
