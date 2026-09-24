#pragma once

#include "IByteReaderWithPosition.h"
#include "napi/NapiSupport.h"

class ObjectByteReaderWithPosition : public IByteReaderWithPosition {
public:
  ObjectByteReaderWithPosition(napi_env env, napi_value object);
  ~ObjectByteReaderWithPosition() override = default;

  IOBasicTypes::LongBufferSizeType
  Read(IOBasicTypes::Byte *buffer,
       IOBasicTypes::LongBufferSizeType bufferSize) override;
  bool NotEnded() override;
  void SetPosition(LongFilePositionType offsetFromStart) override;
  void SetPositionFromEnd(LongFilePositionType offsetFromEnd) override;
  LongFilePositionType GetCurrentPosition() override;
  void Skip(LongBufferSizeType skipSize) override;
  void MoveStartPosition(LongFilePositionType startPosition);

private:
  napi_value CallMethod(const char *name,
                        const std::vector<napi_value> &arguments = {});

  napi_env env_;
  muhammara::napi::Reference object_;
};
