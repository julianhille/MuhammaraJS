#pragma once

#include "napi/NapiSupport.h"

class IByteReaderWithPosition;

class ByteReaderWithPositionDriver : public muhammara::napi::ObjectWrap {
public:
  ~ByteReaderWithPositionDriver() override;
  static bool Init(muhammara::napi::ModuleState &state, napi_value exports);
  void SetStream(IByteReaderWithPosition *reader, bool owns);
  IByteReaderWithPosition *GetStream();

private:
  ByteReaderWithPositionDriver();
  static napi_value New(const muhammara::napi::CallbackArgs &args);
  static napi_value Read(const muhammara::napi::CallbackArgs &args);
  static napi_value NotEnded(const muhammara::napi::CallbackArgs &args);
  static napi_value SetPosition(const muhammara::napi::CallbackArgs &args);
  static napi_value
  SetPositionFromEnd(const muhammara::napi::CallbackArgs &args);
  static napi_value
  GetCurrentPosition(const muhammara::napi::CallbackArgs &args);
  static napi_value Skip(const muhammara::napi::CallbackArgs &args);

  IByteReaderWithPosition *mInstance;
  bool mOwns;
};
