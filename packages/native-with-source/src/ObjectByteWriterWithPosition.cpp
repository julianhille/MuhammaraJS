#include "ObjectByteWriterWithPosition.h"

using namespace muhammara::napi;

ObjectByteWriterWithPosition::ObjectByteWriterWithPosition(napi_env env,
                                                           napi_value object)
    : env_(env), object_(env, object) {}

IOBasicTypes::LongBufferSizeType
ObjectByteWriterWithPosition::Write(const IOBasicTypes::Byte *buffer,
                                    IOBasicTypes::LongBufferSizeType size) {
  napi_value array = BytesToArray(env_, buffer, size);
  if (!array)
    return 0;
  napi_value object = object_.Get();
  napi_value function = Get(env_, object, "write");
  if (!function || !IsType(env_, function, napi_function)) {
    ThrowTypeError(env_, "write is not a function, it should be you know...");
    return 0;
  }
  napi_value result = Call(env_, object, function, {array});
  if (!result)
    return 0;
  if (IsType(env_, result, napi_undefined)) {
    ThrowTypeError(env_, "wrong return value. it's empty. return the number of "
                         "written characters");
    return 0;
  }
  if (!IsType(env_, result, napi_number)) {
    ThrowTypeError(env_, "wrong return value. write should return the number "
                         "of written characters");
    return 0;
  }
  return ToUint32(env_, result);
}

IOBasicTypes::LongFilePositionType
ObjectByteWriterWithPosition::GetCurrentPosition() {
  napi_value object = object_.Get();
  napi_value function = Get(env_, object, "getCurrentPosition");
  if (!function || IsType(env_, function, napi_undefined))
    return 1;
  napi_value result = Call(env_, object, function);
  return result ? static_cast<IOBasicTypes::LongFilePositionType>(
                      ToDouble(env_, result))
                : 0;
}
