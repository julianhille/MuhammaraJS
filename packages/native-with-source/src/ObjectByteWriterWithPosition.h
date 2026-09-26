#pragma once

#include "IByteWriterWithPosition.h"
#include "napi/NapiSupport.h"

#include <vector>

class ObjectByteWriterWithPosition : public IByteWriterWithPosition {
public:
  ObjectByteWriterWithPosition(napi_env env, napi_value object);
  ~ObjectByteWriterWithPosition() override = default;
  IOBasicTypes::LongBufferSizeType
  Write(const IOBasicTypes::Byte *buffer,
        IOBasicTypes::LongBufferSizeType size) override;
  IOBasicTypes::LongFilePositionType GetCurrentPosition() override;
  // Delivers buffered bytes to the JavaScript stream. Owners call this while a
  // JavaScript call is active, before deleting the proxy; the destructor
  // cannot, because it may run from a garbage-collection finalizer.
  PDFHummus::EStatusCode Flush() override;
  // Drops buffered bytes without calling JavaScript, for finalizer cleanup.
  void DiscardPending();

private:
  IOBasicTypes::LongBufferSizeType
  Deliver(const IOBasicTypes::Byte *buffer,
          IOBasicTypes::LongBufferSizeType size);

  napi_env env_;
  muhammara::napi::Reference object_;
  // Encryption streams write one byte at a time; batching keeps that from
  // becoming one JavaScript call and one Buffer per byte.
  std::vector<IOBasicTypes::Byte> pending_;
  // Set once any delivery falls short; the output is corrupt from then on.
  bool failed_;
};
