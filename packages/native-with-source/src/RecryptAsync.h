#pragma once

#include "EPDFVersion.h"
#include "PDFWriter.h"
#include "napi/NapiSupport.h"

#include <string>

// The options recrypt() and recryptAsync() share, so both accept the same
// arguments and reject the same inputs.
struct RecryptArguments {
  EPDFVersion version = ePDFVersionUndefined;
  PDFCreationSettings creation{true, true};
  LogConfiguration log = LogConfiguration::DefaultLogConfiguration();
  std::string password;
};

// Validates the source, destination and options arguments. Returns false with
// a pending exception when they are wrong.
bool ReadRecryptArguments(const muhammara::napi::CallbackArgs &args,
                          RecryptArguments &out);

// The call's log, or no log when its file exists but cannot be appended to,
// such as a directory, a read-only file or device, or a FIFO without a
// reader. PDFWriter's Log only tests files it creates itself: for such a
// file, logging the failed write logs again until the stack overflows, and
// opening a FIFO that no one writes to waits forever.
LogConfiguration UsableRecryptLog(const LogConfiguration &log);

// Points this thread's trace at the call's log. RecryptPDF parses the source
// before StartPDF applies the log, so without this a parse error would go to
// whichever log the thread used last.
void UseRecryptLog(const LogConfiguration &log);

// Turns this thread's trace off once a call that set its own log is done, so
// the log does not apply to anything else.
void ClearRecryptLog();

// Records the log a writer hands PDFWriter, which points this thread's trace
// at it. Trace cannot report its settings, so recrypt() reads this record to
// give the thread its log back once it returns.
void RecordWriterLog(const LogConfiguration &log);

// Turns this thread's trace off and forgets the recorded log, before the log
// stream they may point at is freed.
void ClearWriterLog();

// Points this thread's trace back at the log a writer recorded last.
void RestoreWriterLog();

// recrypt() throws this message and recryptAsync() rejects with it.
inline constexpr const char *kRecryptFailure =
    "Unable to recrypt files, check that input and output files are clear and "
    "arguments are coool";

// Returns a promise and re-encrypts on libuv's thread pool. The jobs of one
// thread run one at a time, in call order; jobs of different threads, and
// synchronous recrypt() calls, run in parallel.
napi_value RecryptAsync(const muhammara::napi::CallbackArgs &args);
