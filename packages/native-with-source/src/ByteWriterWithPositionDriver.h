#pragma once

#include "napi/NapiSupport.h"

class IByteWriterWithPosition;

class ByteWriterWithPositionDriver : public muhammara::napi::ObjectWrap {
public:
  ~ByteWriterWithPositionDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  void SetStream(IByteWriterWithPosition *stream, bool owns);
  IByteWriterWithPosition *GetStream();

private:
  ByteWriterWithPositionDriver();
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value Write(const muhammara::napi::CallbackArgs &args);
  static napi_value
  GetCurrentPosition(const muhammara::napi::CallbackArgs &args);
  IByteWriterWithPosition *instance_;
  bool owns_;
};
