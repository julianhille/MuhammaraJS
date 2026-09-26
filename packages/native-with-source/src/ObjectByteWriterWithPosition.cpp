#include "ObjectByteWriterWithPosition.h"

using namespace muhammara::napi;

ObjectByteWriterWithPosition::ObjectByteWriterWithPosition(napi_env env,
                                                           napi_value object)
    : env_(env), object_(env, object), failed_(false) {}

namespace {
const size_t kFlushSize = 64 * 1024;
}

IOBasicTypes::LongBufferSizeType
ObjectByteWriterWithPosition::Write(const IOBasicTypes::Byte *buffer,
                                    IOBasicTypes::LongBufferSizeType size) {
  if (failed_)
    return 0;
  if (pending_.size() + size > kFlushSize && Flush() != PDFHummus::eSuccess)
    return 0;
  if (size >= kFlushSize) {
    IOBasicTypes::LongBufferSizeType written = Deliver(buffer, size);
    if (written != size)
      failed_ = true;
    return written;
  }
  pending_.insert(pending_.end(), buffer, buffer + size);
  return size;
}

PDFHummus::EStatusCode ObjectByteWriterWithPosition::Flush() {
  if (failed_)
    return PDFHummus::eFailure;
  if (pending_.empty())
    return PDFHummus::eSuccess;
  IOBasicTypes::LongBufferSizeType size = pending_.size();
  IOBasicTypes::LongBufferSizeType written = Deliver(pending_.data(), size);
  pending_.clear();
  // Buffered bytes were already reported as written, so a lost batch
  // corrupts the output; every later write and flush must fail too.
  if (written != size)
    failed_ = true;
  return failed_ ? PDFHummus::eFailure : PDFHummus::eSuccess;
}

void ObjectByteWriterWithPosition::DiscardPending() { pending_.clear(); }

IOBasicTypes::LongBufferSizeType
ObjectByteWriterWithPosition::Deliver(const IOBasicTypes::Byte *buffer,
                                      IOBasicTypes::LongBufferSizeType size) {
  HandleScope scope(env_);
  napi_value bytes = BytesToBuffer(env_, buffer, size);
  if (!bytes)
    return 0;
  napi_value object = object_.Get();
  napi_value function = Get(env_, object, "write");
  if (!function || !IsType(env_, function, napi_function)) {
    ThrowTypeError(env_, "write is not a function, it should be you know...");
    return 0;
  }
  napi_value result = Call(env_, object, function, {bytes});
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
  HandleScope scope(env_);
  napi_value object = object_.Get();
  napi_value function = Get(env_, object, "getCurrentPosition");
  if (!function || IsType(env_, function, napi_undefined))
    return 1;
  napi_value result = Call(env_, object, function);
  if (!result)
    return 0;
  double position = 0;
  if (!CoerceToFilePosition(env_, result,
                            "getCurrentPosition must return a finite number",
                            &position))
    return 0;
  return static_cast<IOBasicTypes::LongFilePositionType>(position) +
         static_cast<IOBasicTypes::LongFilePositionType>(pending_.size());
}
