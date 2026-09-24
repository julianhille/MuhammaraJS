#include "ObjectByteWriter.h"

using namespace muhammara::napi;

ObjectByteWriter::ObjectByteWriter(napi_env env, napi_value object)
    : env_(env), object_(env, object) {}

IOBasicTypes::LongBufferSizeType
ObjectByteWriter::Write(const IOBasicTypes::Byte *buffer,
                        IOBasicTypes::LongBufferSizeType size) {
  napi_value array = BytesToArray(env_, buffer, size);
  if (!array)
    return 0;
  napi_value object = object_.Get();
  napi_value function = Get(env_, object, "write");
  if (!function || IsType(env_, function, napi_undefined))
    return 0;
  napi_value result = Call(env_, object, function, {array});
  return result ? ToUint32(env_, result) : 0;
}
