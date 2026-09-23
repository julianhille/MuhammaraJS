#pragma once

#include "napi/NapiSupport.h"

class IByteWriter;

class ByteWriterDriver : public muhammara::napi::ObjectWrap {
public:
  ~ByteWriterDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  void SetStream(IByteWriter *writer, bool owns);
  IByteWriter *GetStream();

private:
  ByteWriterDriver();
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value Write(const muhammara::napi::CallbackArgs &args);
  IByteWriter *mInstance;
  bool mOwns;
};
