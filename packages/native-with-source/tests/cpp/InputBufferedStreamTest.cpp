#include "InputBufferedStream.h"

#include <algorithm>
#include <iostream>

// In-memory source that counts its calls and clamps at the end like a file.
class CountingSource : public IByteReaderWithPosition {
public:
  CountingSource() : mPosition(0), mCalls(0) {}
  enum { kSize = 128 };
  static Byte At(LongFilePositionType i) { return (Byte)(i * 7 + 3); }
  LongBufferSizeType Read(Byte *b, LongBufferSizeType n) {
    ++mCalls;
    LongBufferSizeType count = std::min<LongBufferSizeType>(n, (LongBufferSizeType)kSize - mPosition);
    for (LongBufferSizeType i = 0; i < count; ++i) b[i] = At(mPosition + i);
    mPosition += count;
    return count;
  }
  bool NotEnded() { return mPosition < kSize; }
  void Skip(LongBufferSizeType n) { ++mCalls; mPosition = std::min<LongFilePositionType>((LongFilePositionType)kSize, mPosition + n); }
  void SetPosition(LongFilePositionType p) { ++mCalls; mPosition = std::min<LongFilePositionType>((LongFilePositionType)kSize, p); }
  void SetPositionFromEnd(LongFilePositionType p) { ++mCalls; mPosition = p > kSize ? 0 : kSize - p; }
  LongFilePositionType GetCurrentPosition() { return mPosition; }
  LongFilePositionType mPosition;
  int mCalls;
};

static int failures = 0;

// Reads count bytes at the stream's position and checks them and the position.
static void expectRead(InputBufferedStream &s, LongFilePositionType at, LongBufferSizeType count, const char *what) {
  Byte buf[64];
  if (s.GetCurrentPosition() != at || s.Read(buf, count) != count) {
    std::cerr << what << ": wrong position or short read\n";
    ++failures;
    return;
  }
  for (LongBufferSizeType i = 0; i < count; ++i)
    if (buf[i] != CountingSource::At(at + i)) {
      std::cerr << what << ": wrong byte at " << at + i << "\n";
      ++failures;
      return;
    }
  if (s.GetCurrentPosition() != at + (LongFilePositionType)count) {
    std::cerr << what << ": wrong position after read\n";
    ++failures;
  }
}

int main() {
  const LongBufferSizeType kBuffer = 16;
  CountingSource *source = new CountingSource();
  InputBufferedStream stream(source, kBuffer); // owns the source

  expectRead(stream, 0, 1, "first read"); // buffer now holds [0, 16)
  int calls = source->mCalls;
  stream.SetPosition(5);
  expectRead(stream, 5, 3, "seek inside buffer");
  stream.SetPosition(0);
  expectRead(stream, 0, 2, "seek to buffer start");
  stream.SetPosition(16);
  if (stream.GetCurrentPosition() != 16) { std::cerr << "seek to buffer end: wrong position\n"; ++failures; }
  if (source->mCalls != calls) { std::cerr << "seek inside buffer touched the source\n"; ++failures; }
  expectRead(stream, 16, 20, "read on from buffer end");
  stream.SetPosition(100);
  expectRead(stream, 100, 4, "seek outside buffer");

  // A read past the buffer must empty it, or a later seek maps into stale bytes.
  stream.SetPosition(0);
  expectRead(stream, 0, 1, "refill");
  expectRead(stream, 1, 40, "read past buffer");
  stream.SetPosition(5);
  expectRead(stream, 5, 4, "seek back after read past buffer");

  // The stale buffer shows when the read ends the source without refilling it.
  stream.SetPosition(96);
  expectRead(stream, 96, 1, "refill at end");
  expectRead(stream, 97, 31, "read to the end of the source");
  stream.SetPosition(120);
  expectRead(stream, 120, 4, "seek back after read to the end");

  // Same for a skip past the buffer.
  stream.SetPosition(0);
  expectRead(stream, 0, 1, "refill");
  stream.Skip(40);
  if (stream.GetCurrentPosition() != 41) { std::cerr << "skip past buffer: wrong position\n"; ++failures; }
  stream.SetPosition(5);
  expectRead(stream, 5, 4, "seek back after skip past buffer");

  // A seek from the end must empty the buffer too.
  stream.SetPosition(0);
  expectRead(stream, 0, 1, "refill");
  stream.SetPositionFromEnd(10);
  expectRead(stream, 118, 10, "read after seek from end");

  // A read past a buffer that ends at the source's end must empty it, or the
  // buffered bytes come back again.
  stream.SetPosition(112);
  expectRead(stream, 112, 1, "refill to the end");
  Byte tail[32];
  if (stream.Read(tail, 32) != 15 || stream.GetCurrentPosition() != 128 || stream.Read(tail, 32) != 0) {
    std::cerr << "read past a buffer ending at the end of the source\n";
    ++failures;
  }

  return failures ? 1 : 0;
}
