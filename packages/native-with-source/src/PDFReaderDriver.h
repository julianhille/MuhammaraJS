#pragma once

#include "DriverLifecycle.h"
#include "InputFile.h"
#include "PDFParser.h"
#include "napi/NapiSupport.h"

class ObjectByteReaderWithPosition;
class ConstructorsHolder;

class PDFReaderDriver : public muhammara::napi::ObjectWrap {
public:
  ~PDFReaderDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  PDFHummus::EStatusCode StartPDFParsing(const std::string &path,
                                         const PDFParsingOptions &options);
  PDFHummus::EStatusCode StartPDFParsing(napi_env env, napi_value stream,
                                         const PDFParsingOptions &options);
  void SetFromOwnedParser(PDFParser *parser,
                          DriverLifecycle ownerLifecycle = DriverLifecycle());
  PDFParser *GetParser();
  DriverLifecycle GetLifecycle();

  ConstructorsHolder *holder;

private:
  PDFReaderDriver();
  static PDFReaderDriver *
  GetActiveReader(const muhammara::napi::CallbackArgs &args);
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value End(const muhammara::napi::CallbackArgs &args);
  static napi_value GetPDFLevel(const muhammara::napi::CallbackArgs &args);
  static napi_value GetPagesCount(const muhammara::napi::CallbackArgs &args);
  static napi_value
  QueryDictionaryObject(const muhammara::napi::CallbackArgs &args);
  static napi_value QueryArrayObject(const muhammara::napi::CallbackArgs &args);
  static napi_value GetTrailer(const muhammara::napi::CallbackArgs &args);
  static napi_value ParseNewObject(const muhammara::napi::CallbackArgs &args);
  static napi_value GetPageObjectID(const muhammara::napi::CallbackArgs &args);
  static napi_value
  ParsePageDictionary(const muhammara::napi::CallbackArgs &args);
  static napi_value ParsePage(const muhammara::napi::CallbackArgs &args);
  static napi_value ExtractPageText(const muhammara::napi::CallbackArgs &args);
  static napi_value
  ExtractPageContentItems(const muhammara::napi::CallbackArgs &args);
  static napi_value GetObjectsCount(const muhammara::napi::CallbackArgs &args);
  static napi_value IsEncrypted(const muhammara::napi::CallbackArgs &args);
  static napi_value GetXrefSize(const muhammara::napi::CallbackArgs &args);
  static napi_value GetXrefEntry(const muhammara::napi::CallbackArgs &args);
  static napi_value GetXrefPosition(const muhammara::napi::CallbackArgs &args);
  static napi_value GetParserStream(const muhammara::napi::CallbackArgs &args);
  static napi_value
  StartReadingFromStream(const muhammara::napi::CallbackArgs &args);
  static napi_value StartReadingFromStreamForPlainCopying(
      const muhammara::napi::CallbackArgs &args);
  static napi_value
  StartReadingObjectsFromStream(const muhammara::napi::CallbackArgs &args);
  static napi_value
  StartReadingObjectsFromStreams(const muhammara::napi::CallbackArgs &args);

  bool mStartedWithStream;
  ObjectByteReaderWithPosition *mReadStreamProxy;
  bool mOwnsParser;
  PDFParser *mPDFReader;
  InputFile mPDFFile;
  DriverLifecycle mLifecycle;
};
