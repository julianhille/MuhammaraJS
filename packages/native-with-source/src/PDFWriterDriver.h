#pragma once

#include "ObjectsBasicTypes.h"

#include "CallbackDepth.h"
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
class PDFModifiedPage;
class PDFPage;
class PDFStream;
class PDFWriterDriver;

// Content started by a writer and owned by other objects: forms from
// createFormXObject() not yet ended, pages whose content context is not yet
// written, page modifiers, and streams from objectsContext.startPDFStream().
// Their content stream writes to the writer's output and holds about 0.5 MB
// until ended, and an unfinished one deletes the output when destroyed, so each
// is ended while the output is alive. Shared by the writer and the owners
// because their finalizers run in any order.
struct OpenContent {
  PDFWriterDriver *writer = nullptr;
  std::set<PDFFormXObject *> forms;
  std::set<PDFPage *> pages;
  std::set<PDFModifiedPage *> modifiedPages;
  std::set<PDFStream *> streams;
};

class PDFWriterDriver : public muhammara::napi::ObjectWrap,
                        public IDocumentContextExtender {
public:
  // The number of object IDs allocated so far.
  ObjectIDType ObjectsCount();
  // Free the object IDs allocated from inFirstID on that were never
  // written, so a failed image, form or font load does not leave the
  // cross-reference table unwritable.
  void ReleaseUnwrittenObjects(ObjectIDType inFirstID);
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
  // Ends when the writer ends; objects that use the writer's state depend on
  // it.
  DriverLifecycle GetLifecycle();
  // Only a writer from createWriterToModify() has a modified-file parser.
  bool IsModifyingPDF();
  // Ends the content context of a page or page modifier released by a
  // finalizer. The content is complete, so the PDF can still end.
  void AbandonPage(PDFPage *);
  void AbandonModifiedPage(PDFModifiedPage *);
  // Detaches an unended objects-context stream from the output from a
  // finalizer; like an abandoned form it leaves the PDF incomplete.
  void AbandonStream(PDFStream *);
  std::shared_ptr<OpenContent> GetOpenContent();
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
  void ReleaseOpenContent();
  // Keeps JavaScript out of finalizers: output is buffered, logging dropped
  // and events skipped until the returned value is destroyed.
  class NoJavaScriptScope;
  void ReleaseLogProxy();
  bool startedWithStream_;
  bool catalogUpdateRequired_;
  bool started_;
  bool formAbandoned_;
  // Set while a finalizer ends abandoned content; events are not delivered.
  bool finalizing_;
  DriverLifecycle lifecycle_;
  std::shared_ptr<OpenContent> openContent_;
  CallbackDepth callbackDepth_;
  PDFWriter writer_;
  ObjectByteWriterWithPosition *writeProxy_;
  ObjectByteReaderWithPosition *readProxy_;
  ObjectByteWriter *logProxy_;
  napi_env env_;
  muhammara::napi::Reference self_;
};
