#pragma once

#include "IByteWriterWithPosition.h"
#include "napi/NapiSupport.h"

class ObjectByteWriterWithPosition : public IByteWriterWithPosition {
public:
  ObjectByteWriterWithPosition(napi_env env, napi_value object);
  ~ObjectByteWriterWithPosition() override = default;
  IOBasicTypes::LongBufferSizeType
  Write(const IOBasicTypes::Byte *buffer,
        IOBasicTypes::LongBufferSizeType size) override;
  IOBasicTypes::LongFilePositionType GetCurrentPosition() override;

private:
  napi_env env_;
  muhammara::napi::Reference object_;
};
