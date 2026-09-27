#pragma once

#include "napi/NapiSupport.h"

#include <memory>

class PDFStream;
class ConstructorsHolder;
struct OpenContent;

class PDFStreamDriver : public muhammara::napi::ObjectWrap {
public:
  ~PDFStreamDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);

  ConstructorsHolder *holder;
  PDFStream *PDFStreamInstance;
  bool mOwns;
  // Ends when objectsContext.endPDFStream() finalizes the stream.
  bool EndStream();
  // Set for an owned stream while it is open, see OpenContent.
  std::shared_ptr<OpenContent> openContent;

private:
  PDFStreamDriver();
  DriverLifecycle mStreamLifecycle;
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value GetWriteStream(const muhammara::napi::CallbackArgs &args);
};
