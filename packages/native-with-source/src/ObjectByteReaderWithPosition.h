#pragma once

#include "CallbackDepth.h"
#include "IByteReaderWithPosition.h"
#include "napi/NapiSupport.h"

#include <memory>

class ObjectByteReaderWithPosition
    : public IByteReaderWithPosition,
      private muhammara::napi::CallBoundary::Listener {
public:
  ObjectByteReaderWithPosition(napi_env env, napi_value object);
  ~ObjectByteReaderWithPosition() override;

  IOBasicTypes::LongBufferSizeType
  Read(IOBasicTypes::Byte *buffer,
       IOBasicTypes::LongBufferSizeType bufferSize) override;
  bool NotEnded() override;
  void SetPosition(LongFilePositionType offsetFromStart) override;
  void SetPositionFromEnd(LongFilePositionType offsetFromEnd) override;
  LongFilePositionType GetCurrentPosition() override;
  void Skip(LongBufferSizeType skipSize) override;
  void MoveStartPosition(LongFilePositionType startPosition);
  // Counts the owner's JavaScript calls made through this stream.
  void SetCallbackDepth(const CallbackDepth &depth);

private:
  napi_value CallMethod(const char *name,
                        const std::vector<napi_value> &arguments = {});

  // A PDFRStreamForBuffer with its own methods (see
  // ModuleState::IsBufferReadStream) is read without calling them: the
  // parser reads a byte at a time, and a JavaScript call and a Buffer per
  // byte made large files slow. Its position is loaded from the object when
  // JavaScript calls into the addon and written back when that call returns,
  // so JavaScript sees the same object state between calls. The bytes are
  // looked up on every read, so a detached buffer reads as empty.
  bool LoadBufferStream();
  void SaveBufferStream();
  void OnEnter() override;
  void OnReturn() override;

  napi_env env_;
  muhammara::napi::Reference object_;
  CallbackDepth depth_;
  std::shared_ptr<muhammara::napi::CallBoundary> boundary_;
  muhammara::napi::Reference bytes_;
  bool bufferStream_ = false;
  bool loaded_ = false;
  bool dirty_ = false;
  double position_ = 0;
  double start_ = 0;
  double size_ = 0;
};
