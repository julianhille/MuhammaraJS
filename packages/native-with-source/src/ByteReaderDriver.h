#pragma once

#include "napi/NapiSupport.h"

class IByteReader;

class ByteReaderDriver : public muhammara::napi::ObjectWrap {
public:
  ~ByteReaderDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  void SetStream(IByteReader *reader, bool owns);
  IByteReader *GetStream();

private:
  ByteReaderDriver();
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value Read(const muhammara::napi::CallbackArgs &args);
  static napi_value NotEnded(const muhammara::napi::CallbackArgs &args);

  IByteReader *mInstance;
  bool mOwns;
};
