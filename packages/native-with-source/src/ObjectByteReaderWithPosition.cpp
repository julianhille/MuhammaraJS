#include "ObjectByteReaderWithPosition.h"

#include <algorithm>

using namespace muhammara::napi;

ObjectByteReaderWithPosition::ObjectByteReaderWithPosition(napi_env env,
                                                           napi_value object)
    : env_(env), object_(env, object) {}

napi_value ObjectByteReaderWithPosition::CallMethod(
    const char *name, const std::vector<napi_value> &arguments) {
  return muhammara::napi::CallMethod(env_, object_.Get(), name, arguments);
}

IOBasicTypes::LongBufferSizeType ObjectByteReaderWithPosition::Read(
    IOBasicTypes::Byte *buffer, IOBasicTypes::LongBufferSizeType bufferSize) {
  napi_value result = CallMethod("read", {Number(env_, bufferSize)});
  if (!result || !IsArray(env_, result))
    return 0;
  uint32_t arrayLength = 0;
  if (!Length(env_, result, &arrayLength))
    return 0;
  IOBasicTypes::LongBufferSizeType length = arrayLength;
  if (length > bufferSize)
    length = bufferSize;
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

bool ObjectByteReaderWithPosition::NotEnded() {
  napi_value result = CallMethod("notEnded");
  return result ? ToBoolean(env_, result) : true;
}

void ObjectByteReaderWithPosition::SetPosition(LongFilePositionType offset) {
  CallMethod("setPosition", {Number(env_, offset)});
}

void ObjectByteReaderWithPosition::SetPositionFromEnd(
    LongFilePositionType offset) {
  CallMethod("setPositionFromEnd", {Number(env_, offset)});
}

LongFilePositionType ObjectByteReaderWithPosition::GetCurrentPosition() {
  napi_value result = CallMethod("getCurrentPosition");
  return result ? static_cast<LongFilePositionType>(ToDouble(env_, result)) : 1;
}

void ObjectByteReaderWithPosition::Skip(LongBufferSizeType size) {
  CallMethod("skip", {Number(env_, size)});
}

void ObjectByteReaderWithPosition::MoveStartPosition(
    LongFilePositionType position) {
  CallMethod("moveStartPosition", {Number(env_, position)});
}
