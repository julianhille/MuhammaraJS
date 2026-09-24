#pragma once

#include "IByteReader.h"
#include "napi/NapiSupport.h"

class ObjectByteReader : public IByteReader {
public:
  ObjectByteReader(napi_env env, napi_value object);
  ~ObjectByteReader() override = default;

  IOBasicTypes::LongBufferSizeType
  Read(IOBasicTypes::Byte *buffer,
       IOBasicTypes::LongBufferSizeType size) override;
  bool NotEnded() override;

private:
  napi_value CallMethod(const char *name,
                        const std::vector<napi_value> &arguments = {});
  napi_env env_;
  muhammara::napi::Reference object_;
};
