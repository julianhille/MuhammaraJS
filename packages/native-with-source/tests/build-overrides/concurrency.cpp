#include "IByteWriter.h"
#include "Log.h"
#include "PDFDate.h"
#include "ThreadSafety.h"
#include "Trace.h"
#include "aes.h"

#include <atomic>
#include <cassert>
#include <cstdarg>
#include <cstring>
#include <fstream>
#include <iostream>
#include <iterator>
#include <set>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

using namespace IOBasicTypes;

class Sink : public IByteWriter {
 public:
  std::string bytes;
  bool recurse = false;
  bool fail = false;
  LongBufferSizeType Write(const Byte* data, LongBufferSizeType size) override {
    if (fail) throw std::runtime_error("log sink failure");
    if (recurse) Trace::DefaultTrace().TraceToLog("recursive write failure");
    // Intentionally not synchronized: Log must protect the whole record, not
    // merely each Write, even when different Log instances share this sink.
    std::this_thread::yield();
    bytes.append(reinterpret_cast<const char*>(data), size);
    return size;
  }
};

static void traceList(Trace& trace, const char* format, ...) {
  va_list args;
  va_start(args, format);
  trace.TraceToLog(format, args);
  va_end(args);
}

static std::set<std::string> records(const std::string& bytes, int count) {
  std::set<std::string> result;
  size_t begin = 0;
  while (begin != bytes.size()) {
    size_t end = bytes.find("\r\n", begin);
    assert(end != std::string::npos && end >= begin + 24);
    assert(bytes.compare(begin, 2, "[ ") == 0);
    assert(bytes.compare(begin + 21, 3, " ] ") == 0);
    assert(result.insert(bytes.substr(begin + 24, end - begin - 24)).second);
    begin = end + 2;
  }
  assert(result.size() == static_cast<size_t>(count));
  return result;
}

int main(int argc, char** argv) {
  assert(argc == 2);
  const int workers = 12;
  const int iterations = 200;
  std::atomic<int> ready{0};
  std::atomic<bool> start{false};
  std::vector<Trace*> addresses(workers);
  std::vector<Sink> privateSinks(workers);
  Sink shared;
  std::vector<std::thread> threads;
  Trace* mainTrace = &Trace::DefaultTrace();
  Sink mainSink;
  mainTrace->SetLogSettings(&mainSink, true);
  const std::string filePath = std::string(argv[1]) + "/shared.log";

  for (int id = 0; id != workers; ++id) {
    threads.emplace_back([&, id] {
      Trace& trace = Trace::DefaultTrace();
      addresses[id] = &trace;
      trace.TraceToLog("default disabled");
      trace.SetLogSettings(&privateSinks[id], true);
      ++ready;
      while (!start.load()) std::this_thread::yield();

      // No AES call occurs before this barrier, including on the main thread.
      const unsigned char plain[16] = {
          0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
          0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff};
      const unsigned char expected[3][16] = {
          {0x69, 0xc4, 0xe0, 0xd8, 0x6a, 0x7b, 0x04, 0x30,
           0xd8, 0xcd, 0xb7, 0x80, 0x70, 0xb4, 0xc5, 0x5a},
          {0xdd, 0xa9, 0x7c, 0xa4, 0x86, 0x4c, 0xdf, 0xe0,
           0x6e, 0xaf, 0x70, 0xa0, 0xec, 0x0d, 0x71, 0x91},
          {0x8e, 0xa2, 0xb7, 0xca, 0x51, 0x67, 0x45, 0xbf,
           0xea, 0xfc, 0x49, 0x90, 0x4b, 0x49, 0x60, 0x89}};
      unsigned char key[32];
      for (unsigned char i = 0; i != 32; ++i) key[i] = i;
      for (int n = 0; n != iterations; ++n) {
        for (int width = 0; width != 3; ++width) {
          alignas(16) aes_encrypt_ctx enc;
          alignas(16) aes_decrypt_ctx dec;
          unsigned char cipher[16], restored[16];
          assert(aes_encrypt_key(key, 16 + width * 8, &enc) == 0);
          assert(aes_decrypt_key(key, 16 + width * 8, &dec) == 0);
          assert(aes_encrypt(plain, cipher, &enc) == 0);
          assert(std::memcmp(cipher, expected[width], 16) == 0);
          assert(aes_decrypt(cipher, restored, &dec) == 0);
          assert(std::memcmp(restored, plain, 16) == 0);
        }
        PDFDate date;
        date.SetToCurrentTime();
        assert(date.Year >= 2026 && date.Month >= 1 && date.Month <= 12);
        assert(date.Day >= 1 && date.Day <= 31 && date.Second >= 0 && date.Second <= 60);
        assert(date.ToString().compare(0, 2, "D:") == 0);
        // Distinct epochs expose accidentally shared localtime/gmtime storage.
        for (int j = 0; j != 10; ++j) {
          time_t epoch = 946684800 + id * 86400;
          tm local{}, utc{};
          assert(MuhammaraBuild::LocalTime(epoch, local));
          assert(MuhammaraBuild::GmTime(epoch, utc));
          std::this_thread::yield();
          assert(utc.tm_year == 100 && utc.tm_mon == 0 && utc.tm_mday == id + 1);
          tm again{};
          assert(MuhammaraBuild::LocalTime(epoch, again));
          assert(local.tm_year == again.tm_year && local.tm_mday == again.tm_mday);
        }
        trace.TraceToLog("private-%d-%d", id, n);
        Log log(&shared);
        log.LogEntry("shared-" + std::to_string(id) + "-" + std::to_string(n));
      }
      const std::string longMessage(MAX_TRACE_SIZE + 100, 'A' + id);
      trace.TraceToLog("%s", longMessage.c_str());
      traceList(trace, "%s", (std::string("list-") + longMessage).c_str());
      trace.SetLogSettings(static_cast<IByteWriter*>(nullptr), false);
      trace.TraceToLog("disabled after reset");

      // Race lazy file creation/BOM and writes larger than OutputBufferedStream.
      Log fileLog(filePath, true);
      for (int n = 0; n != 20; ++n) {
        fileLog.LogEntry(std::to_string(id) + ":" + std::to_string(n) + ":" +
                         std::string(8192, 'A' + id));
      }
    });
  }
  while (ready.load() != workers) std::this_thread::yield();
  start = true;
  mainTrace->TraceToLog("main-only");
  for (auto& thread : threads) thread.join();
  assert(std::set<Trace*>(addresses.begin(), addresses.end()).size() == workers);
  for (auto address : addresses) assert(address != mainTrace);
  assert(records(mainSink.bytes, 1).count("main-only") == 1);
  auto sharedRecords = records(shared.bytes, workers * iterations);
  for (int id = 0; id != workers; ++id) {
    auto own = records(privateSinks[id].bytes, iterations + 2);
    for (int n = 0; n != iterations; ++n) {
      assert(own.count("private-" + std::to_string(id) + "-" + std::to_string(n)) == 1);
      assert(sharedRecords.count("shared-" + std::to_string(id) + "-" + std::to_string(n)) == 1);
    }
    assert(own.count(std::string(MAX_TRACE_SIZE - 1, 'A' + id)) == 1);
    assert(own.count("list-" + std::string(MAX_TRACE_SIZE - 6, 'A' + id)) == 1);
  }
  std::ifstream input(filePath, std::ios::binary);
  std::string bytes{std::istreambuf_iterator<char>(input), {}};
  assert(bytes.compare(0, 3, "\xef\xbb\xbf") == 0);
  auto fileRecords = records(bytes.substr(3), workers * 20);
  for (int id = 0; id != workers; ++id) {
    for (int n = 0; n != 20; ++n) {
      assert(fileRecords.count(std::to_string(id) + ":" + std::to_string(n) + ":" +
                               std::string(8192, 'A' + id)) == 1);
    }
  }

  Sink recursive;
  recursive.recurse = true;
  mainTrace->SetLogSettings(&recursive, true);
  mainTrace->TraceToLog("outer-only");
  assert(records(recursive.bytes, 1).count("outer-only") == 1);
  Sink throwing;
  throwing.fail = true;
  mainTrace->SetLogSettings(&throwing, true);
  bool caught = false;
  try {
    mainTrace->TraceToLog("throws under the sink lock");
  } catch (const std::runtime_error&) {
    caught = true;
  }
  assert(caught && MuhammaraBuild::LogDepth() == 0);
  std::thread afterFailure([&] {
    Log log(&shared);
    log.LogEntry("lock released after exception");
  });
  afterFailure.join();
  assert(shared.bytes.find("lock released after exception") != std::string::npos);
  mainTrace->SetLogSettings(std::string(argv[1]) + "/missing/log", true, true);
  mainTrace->TraceToLog("unwritable construction");
  // Existing path, then removal: failure in OpenFile must not recurse or write
  // through a null stream. Point to a directory for a portable open failure.
  mainTrace->SetLogSettings(std::string(argv[1]), true, false);
  mainTrace->TraceToLog("unwritable append");
  mainTrace->SetLogSettings(static_cast<IByteWriter*>(nullptr), false);
  std::cout << "Trace routing/buffers, whole log records, dates, cold AES: passed\n";
}
