#pragma once

#include "CallbackDepth.h"
#include "IByteWriter.h"
#include "napi/NapiSupport.h"

class ObjectByteWriter : public IByteWriter {
public:
  ObjectByteWriter(napi_env env, napi_value object);
  ~ObjectByteWriter() override = default;
  IOBasicTypes::LongBufferSizeType
  Write(const IOBasicTypes::Byte *buffer,
        IOBasicTypes::LongBufferSizeType size) override;
  // Counts the owner's JavaScript calls made through this stream.
  void SetCallbackDepth(const CallbackDepth &depth);

private:
  napi_env env_;
  muhammara::napi::Reference object_;
  CallbackDepth depth_;
};
