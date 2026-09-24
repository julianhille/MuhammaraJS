#pragma once

#include "IByteWriter.h"
#include "napi/NapiSupport.h"

class ObjectByteWriter : public IByteWriter {
public:
  ObjectByteWriter(napi_env env, napi_value object);
  ~ObjectByteWriter() override = default;
  IOBasicTypes::LongBufferSizeType
  Write(const IOBasicTypes::Byte *buffer,
        IOBasicTypes::LongBufferSizeType size) override;

private:
  napi_env env_;
  muhammara::napi::Reference object_;
};
