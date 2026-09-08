var fs = require("node:fs");
var path = require("node:path");

var aesFiles = [
  "aescrypt.c",
  "aeskey.c",
  "aes_ni.c",
  "aes_modes.c",
  "aestab.c",
  "aesopt.h",
  "brg_endian.h",
  "aes.h",
  "aestab.h",
  "brg_types.h",
  "aes_via_ace.h",
  "aes_ni.h",
  "aescpp.h",
];

function generate(output, deps = path.resolve(__dirname, "../deps")) {
  var files = {};
  function load(name) {
    return fs
      .readFileSync(path.join(deps, name), "utf8")
      .replace(/\r\n/g, "\n");
  }
  function replace(source, before, after, count = 1) {
    var parts = source.split(before);
    if (parts.length !== count + 1) {
      throw new Error(
        `Native build override mismatch (${count} expected): ${before}`,
      );
    }
    return parts.join(after);
  }

  var trace = load("PDFWriter/Trace.cpp");
  trace = replace(
    trace,
    '#include "Trace.h"',
    '#include "Trace.h"\n#include "ThreadSafety.h"',
  );
  trace = replace(
    trace,
    "static Trace default_trace;",
    "static thread_local Trace default_trace;",
  );
  trace = replace(
    trace,
    "mShouldLog = false;",
    "mShouldLog = false;\n\tmLogStream = NULL;\n\tmPlaceUTF8Bom = false;\n\tmBuffer[0] = '\\0';",
  );
  // OutputFile failures and stream callbacks must not recursively log themselves.
  trace = replace(
    trace,
    "\n\tif(mShouldLog)\n",
    "\n\tif(MuhammaraBuild::LogDepth() != 0) return;\n\tif(mShouldLog)\n",
    2,
  );
  files["Trace.cpp"] = trace;

  var log = load("PDFWriter/Log.cpp");
  log = replace(
    log,
    '#include "Log.h"',
    '#include "Log.h"\n#include "ThreadSafety.h"',
  );
  log = replace(
    log,
    "Log::Log(const std::string& inLogFilePath,bool inPlaceUTF8Bom)\n{",
    "Log::Log(const std::string& inLogFilePath,bool inPlaceUTF8Bom)\n{\n    MuhammaraBuild::LogGuard guard;",
  );
  for (var method of ["LogEntryToFile", "LogEntryToStream"]) {
    var signature = `void Log::${method}(const Byte* inMessage, LongBufferSizeType inMessageSize)\n{`;
    log = replace(
      log,
      signature,
      signature +
        "\n    MuhammaraBuild::LogGuard guard;\n    if(!guard.IsOuter()) return;",
    );
  }
  log = replace(
    log,
    "mLogFile.OpenFile(inLogFilePath);",
    "if(mLogFile.OpenFile(inLogFilePath) != PDFHummus::eSuccess)\n            {\n                mLogStream = NULL;\n                mLogMethod = STATIC_LogEntryToFile;\n                return;\n            }",
  );
  log = replace(
    log,
    "mLogFile.OpenFile(mFilePath,true);",
    "if(mLogFile.OpenFile(mFilePath,true) != PDFHummus::eSuccess) return;",
  );
  log = replace(
    log,
    "SAFE_LOCAL_TIME(structuredLocalTime,currentTime);",
    'if(!MuhammaraBuild::LocalTime(currentTime, structuredLocalTime)) return "";',
  );
  files["Log.cpp"] = log;

  var date = load("PDFWriter/PDFDate.cpp");
  date = replace(
    date,
    '#include "PDFDate.h"',
    '#include "PDFDate.h"\n#include "ThreadSafety.h"',
  );
  date = replace(
    date,
    "SAFE_LOCAL_TIME(structuredLocalTime,currentTime);",
    "if(!MuhammaraBuild::LocalTime(currentTime, structuredLocalTime))\n    {\n        SetTime(-1);\n        return;\n    }",
  );
  date = replace(
    date,
    "struct tm *gmTime;",
    "struct tm gmStorage;\n    struct tm *gmTime = &gmStorage;",
  );
  date = replace(
    date,
    "gmTime = gmtime(&localEpoch);",
    "if(!MuhammaraBuild::GmTime(localEpoch, gmStorage))\n    {\n        UTC = eUndefined;\n        return;\n    }",
  );
  files["PDFDate.cpp"] = date;

  // Copy the small AES source/header closure together: quoted includes otherwise
  // resolve beside the vendor source first, bypassing an include_dir override.
  for (var name of aesFiles) files[name] = load("LibAesgm/" + name);
  files["aes_ni.c"] = replace(
    files["aes_ni.c"],
    '#include "aes_ni.h"',
    '#include "aes_ni.h"\n#include "aes-thread-local.h"',
  );
  files["aes_ni.c"] = replace(
    files["aes_ni.c"],
    "static int test = -1;",
    "static MUHAMMARA_THREAD_LOCAL int test = -1;",
    2,
  );
  var via = files["aes_via_ace.h"];
  via = replace(
    via,
    "static unsigned char via_flags = 0;",
    '#include "aes-thread-local.h"\nstatic MUHAMMARA_THREAD_LOCAL unsigned char via_flags = 0;',
  );
  // MSVC inline assembly cannot directly address TLS. Keep probe assembly local
  // and let C generate TLS addressing, including the recurring negative probe.
  via = replace(
    via,
    "        mov     [via_flags],dl  /* set VIA detected flag    */\n",
    "",
  );
  via = replace(
    via,
    "        mov     ret_value,al    /*     able to change it    */\n        pop     ebx\n    }\n    return (int)ret_value;",
    "        mov     ret_value,al    /*     able to change it    */\n        pop     ebx\n    }\n    via_flags = (unsigned char)(ret_value | NEH_CPU_READ);\n    return (int)ret_value;",
  );
  via = replace(
    via,
    "        or      [via_flags],al  /* present & enabled flags  */\n",
    "",
  );
  via = replace(
    via,
    "no_rng:\n    }\n    return (int)ret_value;",
    "no_rng:\n    }\n    via_flags |= (unsigned char)ret_value;\n    return (int)ret_value;",
  );
  files["aes_via_ace.h"] = via;

  // Verify everything before writing anything. Never accept a vendor destination.
  output = path.resolve(output);
  var parent = output;
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  output = path.resolve(fs.realpathSync(parent), path.relative(parent, output));
  var relative = path.relative(fs.realpathSync(deps), output);
  if (
    !relative ||
    (!relative.startsWith(".." + path.sep) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  ) {
    throw new Error(
      "Native build overrides must be generated outside src/deps",
    );
  }
  fs.mkdirSync(output, { recursive: true });
  for (var name of Object.keys(files)) {
    var destination = path.join(output, name);
    if (
      fs.lstatSync(destination, { throwIfNoEntry: false })?.isSymbolicLink()
    ) {
      throw new Error(
        "Native build override output must not be a symbolic link",
      );
    }
  }
  for (var [name, source] of Object.entries(files)) {
    fs.writeFileSync(path.join(output, name), source);
  }
}

module.exports = { generate, aesFiles };
if (require.main === module) {
  if (process.argv.length !== 3)
    throw new Error("Usage: node generate.cjs OUTPUT_DIRECTORY");
  generate(process.argv[2]);
}
