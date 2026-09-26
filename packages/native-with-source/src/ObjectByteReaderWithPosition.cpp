#include "ObjectByteReaderWithPosition.h"

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
  HandleScope scope(env_);
  napi_value result = CallMethod("read", {Number(env_, bufferSize)});
  if (!result)
    return 0;
  size_t length = 0;
  if (!ReadStreamChunk(env_, result, buffer, bufferSize, &length))
    return 0;
  return length;
}

bool ObjectByteReaderWithPosition::NotEnded() {
  HandleScope scope(env_);
  napi_value result = CallMethod("notEnded");
  return result ? ToBoolean(env_, result) : true;
}

void ObjectByteReaderWithPosition::SetPosition(LongFilePositionType offset) {
  HandleScope scope(env_);
  CallMethod("setPosition", {Number(env_, offset)});
}

void ObjectByteReaderWithPosition::SetPositionFromEnd(
    LongFilePositionType offset) {
  HandleScope scope(env_);
  CallMethod("setPositionFromEnd", {Number(env_, offset)});
}

LongFilePositionType ObjectByteReaderWithPosition::GetCurrentPosition() {
  HandleScope scope(env_);
  napi_value result = CallMethod("getCurrentPosition");
  if (!result)
    return 1;
  double position = 0;
  if (!CoerceToFilePosition(env_, result,
                            "getCurrentPosition must return a finite number",
                            &position))
    return 0;
  return static_cast<LongFilePositionType>(position);
}

void ObjectByteReaderWithPosition::Skip(LongBufferSizeType size) {
  HandleScope scope(env_);
  CallMethod("skip", {Number(env_, size)});
}

void ObjectByteReaderWithPosition::MoveStartPosition(
    LongFilePositionType position) {
  HandleScope scope(env_);
  CallMethod("moveStartPosition", {Number(env_, position)});
}
