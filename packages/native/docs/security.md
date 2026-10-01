# Security And Vendored Dependencies

MuhammaraJS compiles the native code under
`packages/native-with-source/src/deps/` into its addon. Every
directory in that location is vendored source code; none is installed or kept
current automatically by npm or another package manager. The versions below
describe the source currently in this repository.

## Vendor Inventory

| Vendored directory | Upstream baseline                                            | Source and tracking                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PDFWriter`        | PDF-Writer v4.9.1                                            | [Source](https://github.com/galkahana/PDF-Writer) and [issues](https://github.com/galkahana/PDF-Writer/issues)                                                                                                         |
| `FreeType`         | 2.14.3                                                       | [Source](https://github.com/freetype/freetype) and [issues](https://gitlab.freedesktop.org/freetype/freetype/-/issues)                                                                                                 |
| `LibAesgm`         | Unversioned Brian Gladman AES snapshot (copyright 1998-2013) | [Source](https://github.com/BrianGladman/AES)                                                                                                                                                                          |
| `LibJpeg`          | [IJG JPEG 10](https://ijg.org/files/jpegsrc.v10.tar.gz)      | [Source](https://ijg.org/)                                                                                                                                                                                             |
| `LibPng`           | [1.6.59](https://github.com/pnggroup/libpng/tree/v1.6.59)    | [Source](https://github.com/pnggroup/libpng) and [issues](https://github.com/pnggroup/libpng/issues)                                                                                                                   |
| `LibTiff`          | [4.7.2](https://gitlab.com/libtiff/libtiff/-/tree/v4.7.2)    | [Source](https://gitlab.com/libtiff/libtiff) and [issues](https://gitlab.com/libtiff/libtiff/-/issues)                                                                                                                 |
| `OpenSSL`          | 3.5.4                                                        | Source bundled as `native-with-source/src/deps/openssl-3.5.4.tar.gz`, compiled by GYP into ignored architecture-specific `openssl-build/` output, then statically linked; [source](https://github.com/openssl/openssl) |
| `Zlib`             | 1.3.1                                                        | [Source](https://github.com/madler/zlib) and [issues](https://github.com/madler/zlib/issues)                                                                                                                           |

The PDFWriter tag is the vendored tree's upstream baseline. MuhammaraJS carries
changes on top of it, so `packages/native-with-source/src/deps/PDFWriter` is not
byte-for-byte identical to that tag;
[`MUHAMMARAJS_PATCHES.md`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/src/deps/PDFWriter/MUHAMMARAJS_PATCHES.md)
in that directory lists each change and why it was made. The other version identifiers come from the vendored
source headers; `LibAesgm` does not declare an upstream release version.
OpenSSL's pinned source archive is included only in the source-capable npm package,
which remains below npm's 256 MiB tarball limit. Local source builds and CI extract
it through a GYP action into ignored architecture-specific `openssl-build/`
output, compile `libcrypto`, and link that static library into the addon.
Official native prebuilts statically link OpenSSL libcrypto and therefore do
not require a system OpenSSL installation at runtime.

## Thread-Safety Patches In PDFWriter

`recryptAsync()` runs `PDFWriter::RecryptPDF` on a libuv pool thread while
writers and readers keep running on the JavaScript thread. The upstream
PDFWriter keeps some state process-wide, so MuhammaraJS changes three places in
`packages/native-with-source/src/deps/PDFWriter`. Each change carries a
`MuhammaraJS:` comment in the source and is listed in `MUHAMMARAJS_PATCHES.md`
with the other local changes.

| File                     | Upstream                                                                 | MuhammaraJS                                                    | Why                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Trace.cpp`              | `Trace::DefaultTrace()` returns one `static Trace` for the whole process | `static thread_local Trace`, one trace per thread              | `StartPDF` writes the default trace's log settings, and `TRACE_LOG` reads them. A job on a pool thread would race with writers on the JavaScript thread.    |
| `SafeBufferMacrosDefs.h` | `SAFE_LOCAL_TIME` uses `localtime()` on POSIX                            | `localtime_r()` on POSIX; Windows already used `localtime_s()` | `localtime()` returns a shared static buffer. `PDFDate::SetToCurrentTime()` and log timestamps call it, and recrypt sets the file ID and `ModDate` from it. |
| `PDFDate.cpp`            | `SetToCurrentTime()` calls `gmtime()`                                    | `gmtime_r()` on POSIX, `gmtime_s()` on Windows                 | Same shared static buffer as `localtime()`.                                                                                                                 |

These changes keep the behavior on a single thread the same. One effect is
visible to callers: log settings now belong to the thread that sets them, so a
writer's `log` option in a worker thread no longer changes where writers on
other threads log.

The patches do not make PDFWriter safe for concurrent recrypts. The rest of the
library has not been audited for that, so every recrypt, synchronous or not,
holds a process-wide mutex while it runs, and only one recrypt runs at a time.
Other global state was checked and left unchanged:

- Function-local statics such as `PDFTextString::Empty()` and
  `PDFParsingOptions::DefaultPDFParsingOptions()` are initialized thread-safely
  and never written afterwards.
- `AbstractContentContext`'s CSS color map is built at load time and only read.
- LibAesgm's AES-NI and VIA detection caches only exist in builds with `-maes`
  or on 32-bit x86. The default x64 build uses neither, and its tables are
  static.
- `rand()` is only used by the Type 2 (CFF) charstring interpreter for font
  embedding, which recrypt does not call.

The addon also initializes OpenSSL with `OPENSSL_INIT_NO_ATEXIT`, so
`process.exit()` does not free OpenSSL's global state while a job still uses
it on a pool thread. The process ends right after and releases it anyway.

When updating PDFWriter, reapply these three changes with the others in
`MUHAMMARAJS_PATCHES.md`. Keep the `recryptAsync` tests in
`packages/native-with-source/tests/Xcryption.js` and the sanitizer CI job
passing.

## Reporting A Defect

For a suspected defect in the PDF processing engine, first check the
[PDF-Writer issue tracker](https://github.com/galkahana/PDF-Writer/issues) and
report it upstream when it belongs there. Include a minimal input and expected
behavior, and link the upstream report from the corresponding MuhammaraJS
issue when the integration, packaging, or local patches are relevant.

Use the same approach for FreeType, libpng, libtiff, zlib, and the other
vendored libraries: report a library defect to its upstream project where it
can be maintained, and use a MuhammaraJS issue for effects specific to this
addon.

## Updating A Vendor

An available newer upstream version is useful information. Open a MuhammaraJS
issue requesting a dependency update when it includes a relevant security fix,
bug fix, or compatibility improvement. Include the current inventory version,
the proposed upstream version or immutable revision, the upstream release or
advisory link, and any expected build or behavior impact. Maintainers can then
evaluate, test, and review the vendor update independently.
