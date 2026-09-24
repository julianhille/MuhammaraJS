#pragma once

#include "EStatusCode.h"
#include "napi/NapiSupport.h"
#include <string>

class OutputFile;

class OutputFileDriver : public muhammara::napi::ObjectWrap {
public:
  ~OutputFileDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  PDFHummus::EStatusCode OpenFile(const std::string &path, bool append);
  void SetFromOwnedFile(OutputFile *file);
  ConstructorsHolder *holder;

private:
  OutputFileDriver();
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value OpenFileJS(const muhammara::napi::CallbackArgs &args);
  static napi_value CloseFile(const muhammara::napi::CallbackArgs &args);
  static napi_value GetFilePath(const muhammara::napi::CallbackArgs &args);
  static napi_value GetOutputStream(const muhammara::napi::CallbackArgs &args);
  OutputFile *outputFile_;
  bool owns_;
};
