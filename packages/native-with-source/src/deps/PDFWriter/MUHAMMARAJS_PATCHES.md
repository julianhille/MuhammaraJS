# MuhammaraJS Changes To PDFWriter

This directory is vendored from
[PDF-Writer v4.9.1](https://github.com/galkahana/PDF-Writer/tree/v4.9.1/PDFWriter).
MuhammaraJS changes the files below. Reapply these changes when updating
PDFWriter, and drop any that the new upstream version already contains.

To list every difference, compare this directory with the upstream tag:

```sh
git clone --depth 1 --branch v4.9.1 https://github.com/galkahana/PDF-Writer.git
diff -ru --strip-trailing-cr PDF-Writer/PDFWriter packages/native-with-source/src/deps/PDFWriter
```

## Thread Safety

`recryptAsync()` runs `PDFWriter::RecryptPDF` on a libuv pool thread while
writers keep running on the JavaScript thread. These changes are marked with
`MuhammaraJS:` comments; the reasons and the audit of the remaining global state
are in
[Security And Vendored Dependencies](../../../../native/docs/security.md#thread-safety-patches-in-pdfwriter).

| File                     | Change                                                        |
| ------------------------ | ------------------------------------------------------------- |
| `Trace.cpp`              | `Trace::DefaultTrace()` returns a `static thread_local` trace |
| `SafeBufferMacrosDefs.h` | `SAFE_LOCAL_TIME` uses `localtime_r()` on POSIX               |
| `PDFDate.cpp`            | `SetToCurrentTime()` uses `gmtime_r()` / `gmtime_s()`         |

## Robustness Fixes

| File                                           | Change                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DictionaryContext.h`, `DictionaryContext.cpp` | `Discard()` releases a dictionary without writing its closing `>>`.                                                                                                                                                                                                                     |
| `ObjectsContext.h`, `ObjectsContext.cpp`       | `HasOpenDictionaries()` reports dictionaries left open, and `Cleanup()` discards them instead of writing to an output stream that may already be closed.                                                                                                                                |
| `PDFModifiedPage.cpp`                          | Editing a page tolerates malformed entries: a failed copying context or page dictionary ends the edit with an error instead of leaking, a non-array `Annots` is dropped, `Contents` that do not resolve or are not references are dropped, and non-dictionary `Resources` are replaced. |
| `UsedFontsRepository.cpp`                      | A font that failed to load, cached as `NULL`, no longer fails `WriteUsedFontsDefinitions()` and with it the whole document.                                                                                                                                                             |
| `PDFPageMergingHelper.cpp`                     | `MergePageContent()` deletes the copying context it creates.                                                                                                                                                                                                                            |
| `PDFWriter.cpp`                                | The stream overload of `RecryptPDF()` ends with `EndPDFForStream()` and returns its status, so a failed write is reported.                                                                                                                                                              |

## Build And Formatting

| File                     | Change                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `binding.gyp`            | The GYP target builds the v4.9.1 sources with the bundled OpenSSL for PDF 2.0 encryption, defines `PDFHUMMUS_HAVE_GETENTROPY` on Linux and `USE_BUNDLED`, compiles as C++20 on Windows, and uses the `Zlib` directory name. |
| `PDFDocumentHandler.cpp` | Ends with a newline, as every text file in the repository does.                                                                                                                                                             |
| `licenses/`              | License and notice texts of PDFWriter and of the third-party code in it, which the Wasm build assembles into its license notices. Upstream keeps its license at the repository root.                                        |
