#include "ObjectByteReader.h"

using namespace muhammara::napi;

ObjectByteReader::ObjectByteReader(napi_env env, napi_value object)
    : env_(env), object_(env, object) {}

napi_value
ObjectByteReader::CallMethod(const char *name,
                             const std::vector<napi_value> &arguments) {
  return muhammara::napi::CallMethod(env_, object_.Get(), name, arguments);
}

IOBasicTypes::LongBufferSizeType
ObjectByteReader::Read(IOBasicTypes::Byte *buffer,
                       IOBasicTypes::LongBufferSizeType size) {
  HandleScope scope(env_);
  napi_value result = CallMethod("read", {Number(env_, size)});
  if (!result)
    return 0;
  size_t length = 0;
  if (!ReadStreamChunk(env_, result, buffer, size, &length))
    return 0;
  return length;
}

bool ObjectByteReader::NotEnded() {
  HandleScope scope(env_);
  napi_value result = CallMethod("notEnded");
  return result ? ToBoolean(env_, result) : true;
}
