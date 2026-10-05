#include "ObjectByteReaderWithPosition.h"

#include <algorithm>
#include <cmath>
#include <cstring>

using namespace muhammara::napi;

namespace {
// The field of a PDFRStreamForBuffer as a number; false for anything else.
bool NumberField(napi_env env, napi_value object, const char *name,
                 double *value) {
  napi_value field = nullptr;
  napi_valuetype type = napi_undefined;
  return napi_get_named_property(env, object, name, &field) == napi_ok &&
         napi_typeof(env, field, &type) == napi_ok && type == napi_number &&
         napi_get_value_double(env, field, value) == napi_ok;
}

// Writes a number field, keeping an exception that is already pending.
void SetNumberField(napi_env env, napi_value object, const char *name,
                    double value) {
  napi_value number = nullptr;
  if (napi_create_double(env, value, &number) == napi_ok)
    napi_set_named_property(env, object, name, number);
}
} // namespace

ObjectByteReaderWithPosition::ObjectByteReaderWithPosition(napi_env env,
                                                           napi_value object)
    : env_(env), object_(env, object) {
  ModuleState *state = ModuleState::Get(env);
  if (state && state->IsBufferReadStream(object)) {
    boundary_ = state->Boundary();
    bufferStream_ = true;
    boundary_->Add(this);
  }
}

ObjectByteReaderWithPosition::~ObjectByteReaderWithPosition() {
  if (!boundary_)
    return;
  // Deleted during a call, such as end(): write the position back while
  // JavaScript objects may still be touched. Not from a finalizer.
  if (boundary_->Inside())
    SaveBufferStream();
  boundary_->Remove(this);
}

bool ObjectByteReaderWithPosition::LoadBufferStream() {
  if (!bufferStream_)
    return false;
  if (loaded_)
    return true;
  HandleScope scope(env_);
  napi_value object = object_.Get();
  napi_value bytes = nullptr;
  bool isTypedArray = false;
  napi_typedarray_type type;
  size_t length = 0;
  if (napi_get_named_property(env_, object, "buffer", &bytes) == napi_ok &&
      napi_is_typedarray(env_, bytes, &isTypedArray) == napi_ok &&
      isTypedArray &&
      napi_get_typedarray_info(env_, bytes, &type, &length, nullptr, nullptr,
                               nullptr) == napi_ok &&
      type == napi_uint8_array &&
      NumberField(env_, object, "rposition", &position_) &&
      NumberField(env_, object, "mStartPosition", &start_) &&
      NumberField(env_, object, "fileSize", &size_) && position_ >= 0 &&
      position_ == std::floor(position_) && bytes_.Reset(env_, bytes)) {
    loaded_ = true;
    return true;
  }
  // Not the shape read() expects: call the methods from now on.
  bufferStream_ = false;
  return false;
}

void ObjectByteReaderWithPosition::SaveBufferStream() {
  if (!dirty_)
    return;
  dirty_ = false;
  HandleScope scope(env_);
  napi_value pending = nullptr;
  bool hasPending = false;
  napi_is_exception_pending(env_, &hasPending);
  if (hasPending)
    napi_get_and_clear_last_exception(env_, &pending);
  SetNumberField(env_, object_.Get(), "rposition", position_);
  SetNumberField(env_, object_.Get(), "mStartPosition", start_);
  if (hasPending) {
    // The call already failed; its exception wins over one from a setter.
    napi_value ignored = nullptr;
    bool raised = false;
    if (napi_is_exception_pending(env_, &raised) == napi_ok && raised)
      napi_get_and_clear_last_exception(env_, &ignored);
    napi_throw(env_, pending);
  }
}

void ObjectByteReaderWithPosition::OnEnter() { loaded_ = false; }

void ObjectByteReaderWithPosition::OnReturn() {
  SaveBufferStream();
  loaded_ = false;
}

void ObjectByteReaderWithPosition::SetCallbackDepth(
    const CallbackDepth &depth) {
  depth_ = depth;
}

napi_value ObjectByteReaderWithPosition::CallMethod(
    const char *name, const std::vector<napi_value> &arguments) {
  CallbackScope callback(depth_);
  return muhammara::napi::CallMethod(env_, object_.Get(), name, arguments);
}

IOBasicTypes::LongBufferSizeType ObjectByteReaderWithPosition::Read(
    IOBasicTypes::Byte *buffer, IOBasicTypes::LongBufferSizeType bufferSize) {
  if (LoadBufferStream()) {
    // read(): copy buffer.subarray(rposition, rposition + n), then advance
    // rposition by n, even past the end.
    HandleScope scope(env_);
    napi_typedarray_type type;
    size_t length = 0;
    void *data = nullptr;
    if (napi_get_typedarray_info(env_, bytes_.Get(), &type, &length, &data,
                                 nullptr, nullptr) != napi_ok)
      length = 0;
    double from = std::min(position_, static_cast<double>(length));
    size_t count = static_cast<size_t>(
        std::min(static_cast<double>(length) - from,
                 static_cast<double>(bufferSize)));
    if (count > 0)
      memcpy(buffer,
             static_cast<const IOBasicTypes::Byte *>(data) +
                 static_cast<size_t>(from),
             count);
    position_ += static_cast<double>(bufferSize);
    dirty_ = true;
    return count;
  }
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
  if (LoadBufferStream())
    return position_ < size_;
  HandleScope scope(env_);
  napi_value result = CallMethod("notEnded");
  return result ? ToBoolean(env_, result) : true;
}

void ObjectByteReaderWithPosition::SetPosition(LongFilePositionType offset) {
  if (LoadBufferStream()) {
    position_ = std::min(
        std::max(start_ + static_cast<double>(offset), 0.0), size_);
    dirty_ = true;
    return;
  }
  HandleScope scope(env_);
  CallMethod("setPosition", {Number(env_, offset)});
}

void ObjectByteReaderWithPosition::SetPositionFromEnd(
    LongFilePositionType offset) {
  if (LoadBufferStream()) {
    position_ =
        std::min(std::max(size_ - static_cast<double>(offset), 0.0), size_);
    dirty_ = true;
    return;
  }
  HandleScope scope(env_);
  CallMethod("setPositionFromEnd", {Number(env_, offset)});
}

LongFilePositionType ObjectByteReaderWithPosition::GetCurrentPosition() {
  if (LoadBufferStream()) {
    if (std::isfinite(position_ - start_))
      return static_cast<LongFilePositionType>(position_ - start_);
    // Let getCurrentPosition() report it, from the state written back.
    SaveBufferStream();
    bufferStream_ = false;
  }
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
  if (LoadBufferStream()) {
    position_ += static_cast<double>(size);
    dirty_ = true;
    return;
  }
  HandleScope scope(env_);
  CallMethod("skip", {Number(env_, size)});
}

void ObjectByteReaderWithPosition::MoveStartPosition(
    LongFilePositionType position) {
  if (LoadBufferStream()) {
    start_ = static_cast<double>(position);
    dirty_ = true;
    return;
  }
  HandleScope scope(env_);
  CallMethod("moveStartPosition", {Number(env_, position)});
}
