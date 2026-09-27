#pragma once

#include "CallbackDepth.h"
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
  // Drops buffered bytes and fails every later write and flush without
  // calling JavaScript, for output that can no longer become a valid PDF.
  void Close();
  // Counts the owner's JavaScript calls made through this stream.
  void SetCallbackDepth(const CallbackDepth &depth);
  // While deferred, writes are buffered without calling JavaScript, for
  // finalizers that must write; the next flush delivers them.
  void SetDeferred(bool deferred);

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
  CallbackDepth depth_;
  bool deferred_;
  // The last position JavaScript reported and the bytes delivered since, so a
  // deferred or closed stream reports its position without calling it.
  IOBasicTypes::LongFilePositionType reportedPosition_;
  IOBasicTypes::LongFilePositionType deliveredSinceReport_;
};
