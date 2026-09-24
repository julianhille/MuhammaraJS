#include "ObjectByteReader.h"

#include <algorithm>

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
  napi_value result = CallMethod("read", {Number(env_, size)});
  if (!result || !IsArray(env_, result))
    return 0;
  uint32_t arrayLength = 0;
  if (!Length(env_, result, &arrayLength))
    return 0;
  IOBasicTypes::LongBufferSizeType length = arrayLength;
  if (length > size)
    length = size;
  std::vector<IOBasicTypes::Byte> bytes(length);
  for (IOBasicTypes::LongBufferSizeType i = 0; i < length; ++i) {
    napi_value value = nullptr;
    uint32_t byte = 0;
    if (!Get(env_, result, static_cast<uint32_t>(i), &value) ||
        !CoerceToUint32(env_, value, &byte))
      return 0;
    bytes[i] = static_cast<IOBasicTypes::Byte>(byte);
  }
  std::copy(bytes.begin(), bytes.end(), buffer);
  return length;
}

bool ObjectByteReader::NotEnded() {
  napi_value result = CallMethod("notEnded");
  return result ? ToBoolean(env_, result) : true;
}
