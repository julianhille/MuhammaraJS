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
| `PDFDate.h`, `PDFDate.cpp`, `Log.cpp` | `PDFDate::SetThreadTimeZone()` fixes a thread's time zone; `SetToCurrentTime()` and log timestamps then use it instead of reading `TZ` |

## Robustness Fixes

| File                                           | Change                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DictionaryContext.h`, `DictionaryContext.cpp` | `Discard()` releases a dictionary without writing its closing `>>`.                                                                                                                                                                                                                                           |
| `ObjectsContext.h`, `ObjectsContext.cpp`       | `HasOpenDictionaries()` reports dictionaries left open, and `Cleanup()` discards them instead of writing to an output stream that may already be closed. The destructor releases them too, so a writer destroyed without `Cleanup()` after a failed copy no longer leaks them. |
| `PDFModifiedPage.cpp`                          | Editing a page tolerates malformed entries: a failed copying context or page dictionary ends the edit with an error instead of leaking, a non-array `Annots` is dropped, `Contents` that do not resolve or are not references are dropped, and non-dictionary `Resources` are replaced.                       |
| `UsedFontsRepository.cpp`                      | A font that failed to load, cached as `NULL`, no longer fails `WriteUsedFontsDefinitions()` and with it the whole document.                                                                                                                                                                                   |
| `PDFPageMergingHelper.cpp`                     | `MergePageContent()` deletes the copying context it creates.                                                                                                                                                                                                                                                  |
| `PDFParser.cpp`                                | `ParseExistingInDirectStreamObject()` rejects an object stream whose `/N` is negative or larger than the xref table, like the `/Count` check in `ParsePagesObjectIDs()`, instead of terminating the process when the header allocation fails ([#917](https://github.com/julianhille/MuhammaraJS/issues/917)). |
| `PDFWriter.cpp`                                | The stream overload of `RecryptPDF()` ends with `EndPDFForStream()` and returns its status, so a failed write is reported.                                                                                                                                                                                    |
| `PDFUsedFont.cpp`                              | `CalculateTextDimensions()` skips a glyph that FreeType cannot load instead of reading the uninitialized `FT_Glyph` and calling through its class pointer.                                                                                                                                                    |
| `PDFStream.cpp`, `OutputFlateEncodeStream.h`, `OutputFlateEncodeStream.cpp` | The destructor detaches the flate encoder with the new `Detach()`, which drops the unfinished encoding without writing its tail, so a stream deleted without `FinalizeStreamWrite()`, such as the content of a form whose page failed to copy, no longer deletes the document's output stream, and deletes its encryption stream. |
| `InputDCTDecodeStream.h`, `InputDCTDecodeStream.cpp` | libjpeg errors `longjmp` from `error_exit` to a `setjmp` around each libjpeg call, as libjpeg's example does, instead of throwing a C++ exception through libjpeg's C frames, which aborted the process where those frames have no unwind tables (riscv64) and escaped the Wasm module. `Read()` ends decoding after an error in the header or the scan lines instead of reporting pending data it cannot return or calling libjpeg again. |
| `CFFFileInput.cpp` | `GetLocalSubr()` returns no subroutine when the font's private dictionary has no `Subrs`, instead of reading through a null pointer. `ReadLocalSubrsForPrivateDict()` releases subrs it failed to read and leaves the dictionary without subrs, instead of leaking them and reading the map's end iterator. An empty Name INDEX or FDArray, a Top DICT INDEX whose count differs from the font count, and an out-of-range font index fail, in both `ReadTopDictIndex()` overloads, and a font that is not found is reported as a failure. An empty name in the Name INDEX is no longer read past its end. |
| `PDFParserTokenizer.h`, `PDFParserTokenizer.cpp`, `PDFObjectParser.h`, `PDFObjectParser.cpp`, `PDFParser.cpp` | `SetReadLimit()` bounds the bytes a parser reads from its stream, `ConsumeReadBudget()` charges bytes read past it (an inline image skipped through an external read), and `ReachedReadLimit()` reports hitting either. `SetMaxTokenSize()` fails a longer token and stops tokenizing until `ResetReadState()`; the object parsers of `StartReadingObjectsFromStream(s)()` set 32 MiB, as decoded content expands far beyond the input. |
| `InputStreamSkipperStream.h`, `InputStreamSkipperStream.cpp`, `PDFParser.cpp` | `EnableReadAhead()` reads the source in blocks; the object parsers of `StartReadingObjectsFromStream(s)()` use it, so a byte no longer costs a decode-filter call.                                                                                                                                            |
| `SimpleStringTokenizer.h`, `SimpleStringTokenizer.cpp`, `PDFDocumentHandler.cpp` | `SetMaxTokenSize()` keeps at most that many bytes of a token and reads past the rest, so positions and later tokens are unchanged; `ScanStreamForResourcesTokens()` sets 32 MiB, so one token of decoded content no longer grows a string until allocation fails when a page is merged. |
| `InputBufferedStream.cpp`                      | `NotEnded()` checks its buffer before the source stream.                                                                                                                                                                                                                                                      |
| `PDFDocumentHandler.cpp`                       | `ScanStreamForResourcesTokens()` reads the decoded content through a read-ahead buffer, so merging a page no longer costs a decode-filter call per byte.                                                                                                                                                      |
| `PDFDocumentHandler.cpp` | `WriteStreamObject()` closes the stream dictionary it started when copying the dictionary fails. The copy still leaves its object unfinished, so the document cannot end: the failure aborts the copy, it does not recover from it. |
| `PDFDocumentHandler.cpp` | `CreatePDFFormXObjectForPage()` ends the form it started when the page content fails to copy, so the output stays writable; the form is written with the content copied so far. `/ProcSet` entries that are not names are skipped when merging a page into a page or a form, instead of being read as `PDFName`. |
| `PDFObjectCast.h`, `AbstractWrittenFont.cpp`, `DecryptionHelper.cpp`, `DocumentContext.cpp`, `PDFDocumentHandler.cpp`, `UsedFontsRepository.cpp`, `WrittenFontCFF.cpp` | `PDFObjectCastPtr::Borrow()` takes a reference only when the type matches. The 20 sites that cast an array item or dictionary value, which they do not own, use it instead of assignment, which released the borrowed object on a type mismatch. |
| `DecryptionHelper.cpp` | A crypt filter without `/CFM`, which defaults to `None`, is skipped instead of reading its name through a null pointer. |
| `PDFParser.cpp` | `ParseXrefFromXrefStream()` rejects `/W` widths outside 0..8, and `ReadXrefSegmentValue()` accumulates unsigned, so a wide field no longer overflows a signed 64-bit shift. |
| `TIFFImageHandler.cpp` | `WriteImageData()` and `WriteImageTileData()` free their strip and tile buffers after the loop, so error paths no longer leak them. |
| `OpenTypeFileInput.cpp` | `ReadGlyfForDependencies()` registers a glyph entry for cleanup before parsing it, so a composite glyph naming a missing component no longer leaks it. |
| `FreeTypeFaceWrapper.h`, `FreeTypeFaceWrapper.cpp` | `LoadGlyph()` caches only a glyph that loaded, so a failure is reported every time. `ForgetLoadedGlyph()` invalidates the cache after the native driver loads glyphs into the face directly. `GetStemV()` invalidates the cache too, as the OpenType extender loads "l" into the face directly. |
| `FreeTypeOpenTypeWrapper.cpp`, `FontDescriptorWriter.cpp` | An OS/2 `usWidthClass` outside 1..9 is treated as unknown, and the font descriptor writes `Normal` for an out-of-range stretch instead of indexing past the FontStretch names. |
| `PNGImageHandler.cpp` | `CreateImageXObjectForData()` reads each row through `ReadRow()`, which catches a libpng error with its own `setjmp()` and restores the caller's jump buffer, so a later libpng error (such as a missing `IEND`) no longer jumps into a returned frame, and the image stream is released. Locals of the callers that are set after `setjmp()` are `volatile`, so a libpng error no longer leaks the info struct and row buffer. |

## Build And Formatting

| File                     | Change                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `binding.gyp`            | The GYP target builds the v4.9.1 sources with the bundled OpenSSL for PDF 2.0 encryption, defines `PDFHUMMUS_HAVE_GETENTROPY` on Linux and `USE_BUNDLED`, compiles as C++20 on Windows, and uses the `Zlib` directory name. |
| `PDFDocumentHandler.cpp` | Ends with a newline, as every text file in the repository does.                                                                                                                                                             |
| `licenses/`              | License and notice texts of PDFWriter and of the third-party code in it, which the Wasm build assembles into its license notices. Upstream keeps its license at the repository root.                                        |
