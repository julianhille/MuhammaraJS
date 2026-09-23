#pragma once

#include "EStatusCode.h"
#include "napi/NapiSupport.h"

#include <string>

class InputFile;
class ConstructorsHolder;

class InputFileDriver : public muhammara::napi::ObjectWrap {
public:
  ~InputFileDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  PDFHummus::EStatusCode OpenFile(const std::string &path);
  void SetFromOwnedFile(InputFile *file);

  ConstructorsHolder *holder;

private:
  InputFileDriver();
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value OpenFileJS(const muhammara::napi::CallbackArgs &args);
  static napi_value CloseFile(const muhammara::napi::CallbackArgs &args);
  static napi_value GetFilePath(const muhammara::napi::CallbackArgs &args);
  static napi_value GetFileSize(const muhammara::napi::CallbackArgs &args);
  static napi_value GetInputStream(const muhammara::napi::CallbackArgs &args);

  InputFile *mInputFileInstance;
  bool mOwnsInstance;
};
