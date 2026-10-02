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

// recrypt() throws this message and recryptAsync() rejects with it.
inline constexpr const char *kRecryptFailure =
    "Unable to recrypt files, check that input and output files are clear and "
    "arguments are coool";

// Returns a promise and re-encrypts on libuv's thread pool. The jobs of one
// thread run one at a time, in call order; jobs of different threads, and
// synchronous recrypt() calls, run in parallel.
napi_value RecryptAsync(const muhammara::napi::CallbackArgs &args);
