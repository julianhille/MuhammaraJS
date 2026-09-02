# Wasm Low-Level API Parity

## Status

The low-level Wasm API is byte-first and browser-safe. It preserves feasible
Node semantics while intentionally excluding paths, Node streams, EventEmitter
hooks, persistent continuation files, and OpenSSL-dependent encryption. The
test ports run under Node's Emscripten runtime. Real browser and worker execution
is covered by `npm run wasm:test:browser`, which drives headless Firefox through
its built-in WebDriver BiDi Remote Agent without an automation dependency.

| Status   | Meaning                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------- |
| covered  | A Node/Emscripten Wasm test exercises the applicable byte-first behavior.                            |
| alias    | Coverage is provided by a differently named Wasm test.                                               |
| excluded | The Node behavior requires a documented browser-incompatible runtime facility.                       |
| browser  | The shared browser ESM validation runs in both a real page and module Worker.                        |
| partial  | Node/Emscripten tests cover the stated portion; browser validation does not cover the entire family. |

## Coverage Matrix

This maps the non-Recipe Node low-level families to the closest Wasm test or a
specific browser exclusion. A mapping is behavioral rather than a claim of
byte-identical output.

| Node family                                                                                          | Wasm test(s)                                                                                             | Status / notes                                                                  |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `EmptyWriter.js`, `EmptyPagesPDF.js`, `PDFVersionTest.js`                                            | `EmptyWriter.test.mjs`, `EmptyPagesPDF.test.mjs`, `WriterCompression.test.mjs`                           | covered; `EmptyPagesPDF.test.mjs` asserts the actual PDF 2.0 header             |
| `SimpleContentPageTest.js`, `PageBoxes.js`                                                           | `SimpleContentPageTest.test.mjs`, `PageBoxes.test.mjs`                                                   | covered                                                                         |
| `HighLevelContentContext.js`, low-level content operators                                            | `HighLevelContentContext.test.mjs`, `StructuredContentOperators.test.mjs`, `ContentStreamWrite.test.mjs` | covered                                                                         |
| `SimpleTextUsageTest.js`, `TextMeasurementsTest.js`                                                  | `SimpleTextUsageTest.test.mjs`                                                                           | alias                                                                           |
| `TTCFontTest.js`, `DFontTest.js`                                                                     | `FontCatalogParity.test.mjs`                                                                             | alias; byte-backed collection/DFont behavior                                    |
| `SettingInfoValuesTest.js`, `PDFTextString.js`, `SettingInfoValuesFromParsedContentTest.js`          | `SettingInfoValuesTest.test.mjs`, `ParsedStringBytes.test.mjs`                                           | covered                                                                         |
| `LinksTest.js`                                                                                       | `LinksTest.test.mjs`                                                                                     | covered                                                                         |
| `FormXObjectTest.js`, `BasicJPGImagesTest.js`, `BasicPNGImagesTest.js`, `TiffImageTest.js`           | `FormXObjectTest.test.mjs`, `HighLevelImages.test.mjs`                                                   | alias; registered/direct bytes replace files                                    |
| `TiffSpecialsTest.js`                                                                                | `TiffSpecialsTest.test.mjs`                                                                              | covered; byte-backed writer and modifier directory/treatment options            |
| `ImagesAndFormsForwardReferenceTest.js`                                                              | `ImagesAndFormsForwardReferenceTest.test.mjs`                                                            | covered                                                                         |
| `ImageTypeTest.js` and image inspection behavior                                                     | `ImageTypeTest.test.mjs`, `ImageDimensions.test.mjs`, `JPGImageInformation.test.mjs`                     | covered                                                                         |
| `PDFEmbedTest.js`, `MergeToPDFForm.js`, `MergePDFPages.js`, `AppendSpecialPagesTest.js`              | `PDFEmbedTest.test.mjs`, `MergePDFPages.test.mjs`, `AppendPagesTest.test.mjs`                            | covered                                                                         |
| `CopyingAndMergingEmptyPages.js`                                                                     | `PDFEmbedTest.test.mjs`, `MergePDFPages.test.mjs`, `AppendPagesTest.test.mjs`                            | alias; byte-backed form creation, merging, and appending cover empty-page flows |
| `PDFCopyingContextTest.js`, direct-object/deep-copy behavior                                         | `DocumentCopyingContextDeepObjects.test.mjs`, `DocumentCopyingContextSourceParser.test.mjs`              | alias; includes deep copies and source replacement                              |
| `BasicModification.js`, `BasicModification2.js`, `ModifyExistingPageContent.js`, `BufferReadTest.js` | `BasicModification.test.mjs`, `ModifierContentContext.test.mjs`, `ModifierWriterParity.test.mjs`         | alias                                                                           |
| `ModifyingExistingFileContent.js`                                                                    | `ModifyingExistingFileContent.test.mjs`                                                                  | covered; includes modified-page dictionary replacement                          |
| no current root Node test: direct-reference replacement                                              | `ObjectReplacementTest.test.mjs`                                                                         | browser-safe additional coverage                                                |
| `ParseInfo.js`, `PDFParser.js`                                                                       | `PDFParser.test.mjs`, `PDFStreamReader.test.mjs`, `ParsedStringBytes.test.mjs`                           | alias                                                                           |
| no current root Node test: page text extraction                                                      | `PDFTextExtractionTest.test.mjs`                                                                         | browser-safe additional coverage; byte-backed Node-shaped extraction entries    |
| `InputFileTest.js` raw-object behavior                                                               | `InputFileTest.test.mjs`                                                                                 | alias; file constructor itself is excluded                                      |
| `ShutdownRestartTest.js` lifecycle behavior                                                          | `ShutdownRestartTest.test.mjs`                                                                           | alias; persistent continuation remains excluded                                 |
| `tests/security/GHSA-*.js`, `GH-518.js`, `SigSeg.js`                                                 | `security/parser.test.mjs`                                                                               | alias; includes malformed PDF rejection                                         |
| `WriterEvents.js`                                                                                    | none                                                                                                     | excluded: EventEmitter hooks                                                    |
| `StreamCopyingContext.js`, `BasicModificationWithStreams.js`                                         | none                                                                                                     | excluded: Node stream inputs/callback flow                                      |
| path-only portions of `InputFileTest.js` and image/modification tests                                | byte-test aliases above                                                                                  | excluded only for paths; equivalent byte operations are covered                 |
| `Xcryption.js`                                                                                       | none                                                                                                     | excluded: OpenSSL encryption/recrypt                                            |

## API Matrix

| Low-level API family                                                     | Status   | Evidence                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Writer/page/content, fonts/text, metadata, links/annotations             | covered  | creation, content, text, metadata, links, and page tests above                                                                                                                                       |
| JPEG/PNG/TIFF and image inspection                                       | covered  | form, high-level image, TIFF-special, type, dimensions, JPEG-info, and Blob async tests                                                                                                              |
| Forms/resources/PDF embedding                                            | covered  | Node/Emscripten tests cover writer and modifier forms, resources, TIFF/PDF forms, and embedding; Firefox page and Worker validation covers generic form lifecycle, resources, and content streams.   |
| Modify, append, merge, and copying                                       | covered  | modifier context/text, new-page stream access, TIFF forms, append, merge, deep-copy, and modified-file tests                                                                                         |
| Raw objects and dictionary replacement                                   | covered  | `InputFile.test.mjs`, `DocumentCopyingContextDeepObjects.test.mjs`, `ModifyingExistingFileContent.test.mjs`, `ObjectReplacementTest.test.mjs`                                                        |
| Reader/parser/parsed streams and page text extraction                    | covered  | parser, stream-reader, parsed-string, source-parser, page-text extraction, and security tests                                                                                                        |
| Public TypeScript declarations                                           | covered  | `wasm/index.d.ts`; fixture covers writer/modifier form end contracts, sync modifier options, metrics, async callbacks, and `createRecipe()` loading                                                  |
| Paths, Node streams, events, persistent continuation, encryption/recrypt | excluded | Browser runtime or omitted OpenSSL, as documented in [`wasm/README.md`](../wasm/README.md)                                                                                                           |
| Real browser page and Worker byte-first core validation                  | browser  | The runner checks adapters, writer, reader including page text extraction, generic form lifecycle/resources/content streams, modifier behavior, and page-object replacement; CI does not execute it. |

## Completion Gate

Form coverage is complete for the exposed byte-first writer, modifier, resource,
and content-stream behavior. `npm test` remains the native regression suite;
`npm run wasm:test` and `npm run wasm:test:types` validate the checked-in Wasm
suite. `npm run wasm:test:browser` is an automated Firefox validation command
and is not run by CI.
