# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add `DrawingPathType` constants for the `type` option of the low-level
  drawing helpers [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Add `ObjectReplacementScope` constants for the `scope` option of
  `PDFWriter#replaceObject()` [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Declare the `text`, `border`, `color` and `followOriginalPageRotation`
  options that `Recipe#annot()` already reads [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Add `Recipe.Source`, `Recipe.TextWrap`, `Recipe.TextAlign`, `Recipe.TableRowNth`, `Recipe.LineCap`, `Recipe.LineJoin`, `Recipe.ArrowAt`, `Recipe.ArrowType`, `Recipe.TriangleTrait`, `Recipe.TrianglePosition`, `Recipe.PageSize`, `Recipe.PageLayout`, `Recipe.HorizontalAlign`, `Recipe.VerticalAlign`, `Recipe.FontStyle`, `Recipe.Permission`, `Recipe.Coordinate`, `Recipe.Colorspace`, `Recipe.AnnotSubtype`, `Recipe.AnnotFlag` and
  `Recipe.AnnotIcon` and `Recipe.ChromaCommand` constants for the matching
  string options, and declare
  the `password`, `ownerPassword`, `userPassword`, `userProtectionFlag` and
  `fontSrcPath` Recipe constructor options [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Accept `Recipe#line(startX, startY, endX, endY, options?)`, as Wasm does
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Accept a `PDFDate` in `InfoDictionary#setCreationDate()` and
  `setModDate()`, as Wasm does [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Default the `createFormXObjectFromPDFPage()` page box to the media box,
  as Wasm does [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Accept a form XObject object ID in `doXObject()`, as Wasm does
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Default the `d()` dash phase to 0 when it is omitted, as Wasm does
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Accept a `Uint8Array` (or `Buffer`) from custom read streams and in the
  `write()` method of PDF stream writers such as `getWriteStream()`, alongside
  arrays of byte values [#324](https://github.com/julianhille/MuhammaraJS/issues/324)
- Add a guide for annotating known text regions in existing PDFs with Underline
  or StrikeOut annotations [#290](https://github.com/julianhille/MuhammaraJS/issues/290)
- Add `Recipe#removeText(pageNumber, { forms })` to remove all shown text from
  an existing page, for example before adding a new OCR text layer, and a
  guide for replacing a PDF's text layer [#388](https://github.com/julianhille/MuhammaraJS/issues/388)

### Breaking Changes

- Throw a `TypeError` from `Tj()`, `Quote()`, `DoubleQuote()` and `TJ()` when
  a glyph list contains an item that is not a `[glyphId, unicodeCodePoint]`
  array. Previously such items were skipped, so `TJ(["ab", -100, "c"])` wrote
  an empty `[ () ] TJ`; pass the `TJ` items as separate arguments instead:
  `TJ("ab", -100, "c")`. `TJ()` with text items also throws when a glyph list
  comes last instead of treating it as the options object and dropping it [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Declare `toPDF*()` and `toNumber()` on PDF objects as possibly returning
  `undefined`, which they do for a different object type. Strict TypeScript
  code that uses the result directly now fails to compile; check the result or
  `getType()` first [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Deliver custom write stream and `log` chunks as `Buffer`s instead of arrays
  of numbers, and return `Buffer`s from `PDFRStreamForFile#read()`,
  `PDFRStreamForBuffer#read()`, and the byte readers returned by
  `startReadingFromStream()`, `startReadingFromStreamForPlainCopying()`,
  `getParserStream()`, and `getSourceDocumentStream()`. Code using array methods on those bytes, or
  TypeScript streams declaring `write(bytes: number[])`, must switch to Buffer
  operations. Output arrives in batched chunks of up to 64 KiB, with the last
  one delivered when the writer ends, and `write` must return the full chunk
  length: returning less now fails the writer instead of being ignored. See the
  [migration guide](packages/native/docs/getting-started/migrate-from-v6.md#16-accept-buffers-in-custom-streams)
  [#324](https://github.com/julianhille/MuhammaraJS/issues/324)
- Treat a failed `appendPDFPagesFromPDF()` call as terminal for its writer.
  Previously callers could continue after a failed append and produce a
  corrupted document; create a fresh writer and retry with a valid source.
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
- Reject custom-stream `getCurrentPosition()` results that convert to non-finite
  numbers or fall outside `[-2^63, 2^63)` with `TypeError`, preventing corrupt
  PDF offsets. Return the actual finite byte position within that range; numeric
  coercion remains supported. See the
  [stream contract](packages/native/docs/low-level/custom-streams.md)
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750).
- Correct low-level shape `type: "clip"` to clip without painting and end the
  path; unrecognized types end the path without painting or clipping. Use `"clip"` explicitly with
  `q()`/`Q()`, or `"stroke"`/`"fill"` to paint. See the
  [migration guide](packages/native/docs/getting-started/migrate-from-v6.md#15-check-low-level-clipping-options).
- Validate low-level shape and `writeText()` arguments before drawing, and
  propagate conversion errors instead of aborting or emitting partial output.
  Supply finite coordinates, dimensions, stroke widths, and text sizes, and
  at least two complete `drawPath()` coordinate pairs; incomplete paths now
  throw instead of silently drawing a prefix. Correct invalid inputs before retrying. See
  [breaking changes](packages/native/docs/breaking-changes.md).
- Replace runtime-specific Node.js and Electron native binaries with Node-API 8
  prebuilds shared by every supported runtime. Standard npm installs and public
  package imports require no changes, but custom binary mirrors, direct archive
  downloads, and tooling that uses `binding/muhammara.node` must replace
  `node-v{abi}-{platform}-{arch}-{libc}.tar.gz` with
  `napi-v8-{platform}-{arch}-{libc}.tar.gz` and use
  `binding/napi-v8/muhammara.node`. See the
  [migration guide](packages/native/docs/getting-started/migrate-from-v6.md#14-update-native-binary-tooling)
  and [breaking changes](packages/native/docs/breaking-changes.md) page
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
  [#504](https://github.com/julianhille/MuhammaraJS/issues/504)
- Require a Recipe text `size`, or its `fontSize` alias, greater than zero and
  throw `RangeError` naming the option and the value otherwise. `text()`
  clamped a negative size to 1pt, drew nothing visible for zero, and
  `textDimensions()` measured with those values, returning nonsensical font
  metrics; zero and `NaN` also fell back to the 14pt default in some paths.
  Both now throw before drawing or measuring. Pass a size greater than zero, or
  omit the option — `null` and `undefined` still select the 14pt default. See
  the [migration guide](packages/native/docs/getting-started/migrate-from-v6.md#13-pass-a-text-size-greater-than-zero)
  and the [breaking changes](packages/native/docs/breaking-changes.md) page
  [#733](https://github.com/julianhille/MuhammaraJS/issues/733)
- Keep Recipe HTML text outside any element on one line with its neighboring
  inline elements, with one space between them, instead of starting a new line
  for each top-level run and inline element; wrap content in `<p>` or add
  `<br>` where separate lines are intended. `htmlToTextObjects()` returns a
  `<br>` as an object with `lineBreak: true` instead of a placeholder
  paragraph. See the [breaking changes](packages/native/docs/breaking-changes.md)
  page [#667](https://github.com/julianhille/MuhammaraJS/issues/667)
- Derive Recipe `table()` columns from every record instead of only the first,
  keep `order` and `columns` entries even when no record has that field, and
  use exactly the listed `columns` when no `order` is given. A column
  `renderer` result now also sizes its row, and a misspelled `order` or
  `columns` name draws an empty column instead of being dropped. List the intended columns with
  `order` or `columns` to keep a fixed layout; see the
  [breaking changes](packages/native/docs/breaking-changes.md) page
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Include padding, minimum/fixed cell heights, and rendered HTML in Recipe
  table sizing. Tables can grow taller or continue earlier; adjust cell sizing
  and continuation areas using the [migration guide](packages/native/docs/getting-started/migrate-from-v6.md#12-choose-table-columns-explicitly).
  An `overflow` destination too small for a row and its repeated header now
  throws `RangeError` instead of drawing beyond the bounds; return `true` to
  stop or provide a large enough area
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)

### Added

- Add Electron 44.4.5 as the newest tested compatibility boundary on Linux x64,
  macOS arm64, and Windows x64
  [#753](https://github.com/julianhille/MuhammaraJS/issues/753)
- Add regression coverage for `retrieveJPGImageInformation`, the `compress`
  writer option's effect on output bytes, and the low-level `ri`, `i`, `gs`,
  `CS`, `cs`, `SC`, `SCN`, `sc`, and `scn` content-stream operators, closing
  test-parity gaps against `@muhammara/wasm`
  [#725](https://github.com/julianhille/MuhammaraJS/issues/725)

### Fixed

- Place the link of a Recipe `circle()`, `ellipse()`, `arc()` or `pie()`
  drawn at `"center"` coordinates; its rectangle was computed from the string
  and came out invalid [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Stop `Recipe#polygon()` from appending the closing point to the coordinate
  array the caller passed in [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Fix `Recipe#editPage()` throwing in debug mode, where it loaded the bold
  Helvetica font by an outdated name [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Fix Recipe HTML text: links now use the `href` attribute instead of the
  first attribute, `<a>` without attributes no longer throws, and upper-case
  tags such as `<B>`, `<U>` and `<UL>` are styled [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Fix separation colors in every Recipe after the first in a process: the
  Separation color space was cached globally, so later documents referenced
  an object that only existed in the first PDF [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Write the `lockedcontents` annotation flag, which the types accepted but
  Recipe wrote as no flag [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Write `Recipe#annot()` subtypes given in another casing, such as
  `"highlight"`, with their PDF name and default markup color; they were
  written as invalid lower-case names with a black color [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Fix `Recipe#read(inSrc)` reading the Recipe's own Buffer source instead of
  `inSrc`, and failing when `inSrc` is a Buffer [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Apply the Recipe `version` option to new PDFs written to a Buffer; it was
  ignored and those PDFs were always version 1.7 [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Fix native type declarations that rejected working calls or accepted failing
  ones: `addFormXObjectMapping()` takes a form id, `mergePDFPageToFormXObject()`
  takes the target form, `TJ()` takes its items as separate arguments, `Tj()`,
  `Quote()` and `DoubleQuote()` accept an `{ encoding }` options object, and
  `ByteReaderWithPosition#moveStartPosition()` is no longer declared [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Declare the `PDFDate` and `PDFTextString` constructors, the `FormXObject`
  content, stream and resources getters, `FontMetrics`, `"center"` coordinates
  for Recipe `comment()` and `annot()`, and the optional arguments of
  `createPDFTextString()`, `startPDFStream()` and
  `calculateTextDimensions()` [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Make `InfoDictionary#getAdditionalInfoEntries()` work without an argument; it
  previously required an unused key [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Fix Recipe `movedown(lines, true)` throwing a `TypeError` before any text was
  written; it now moves down from the page origin [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Report an out-of-range object ID from `PDFReader#getXrefEntry()` and a
  non-path `drawImage()` source with accurate error messages [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Fix `Recipe#endPDF()` throwing `Node-API call failed` when the source PDF
  Info dictionary has a `/Trapped` entry; the entry is now kept.
  [#779](https://github.com/julianhille/MuhammaraJS/issues/779)
- Clamp `PDFRStreamForFile` and `PDFRStreamForBuffer` seek methods to the
  available bytes, allowing PDFs smaller than the parser's trailer window to be
  read through built-in streams [#784](https://github.com/julianhille/MuhammaraJS/issues/784)
- Make `Recipe#replaceText()` match `text` literally and insert `replacement`
  verbatim. Regular-expression characters such as `.` and `$&` no longer
  change what is matched or written, and characters above U+00FF now throw a
  `TypeError` instead of being written as corrupted bytes
  [#785](https://github.com/julianhille/MuhammaraJS/issues/785)
- Keep non-ASCII bytes in a page's content stream intact when `replaceText()`
  rewrites it; they were previously re-encoded as UTF-8, corrupting other
  strings and inline image data on the page.
- Throw `Unable to read PDF stream` from `startReadingFromStream()` and
  `startReadingFromStreamForPlainCopying()`, and `Unable to read PDF stream
objects` from `startReadingObjectsFromStream()`, when a stream cannot be
  read, such as one whose indirect `/Length` is not a number, instead of
  crashing the process [#778](https://github.com/julianhille/MuhammaraJS/issues/778)
- Keep Recipe `rectangle()` rounded-corner strokes concentric with the fill by
  shrinking corner radii with the stroke inset, draw `ellipse()` strokes as a
  true inset ellipse, and collapse `circle()`, `ellipse()`, `rectangle()`, and
  `arc()` strokes wider than the shape onto it instead of drawing them inverted
  [#743](https://github.com/julianhille/MuhammaraJS/issues/743)
- Keep memory bounded and throughput high while PDF bytes pass through
  JavaScript streams. Modifying a 48 MB PDF with a Buffer-mode `Recipe` drops
  from about 2.2 GB and 16 seconds to about 300 MB and half a second.
  Encrypting into a JavaScript stream with `recrypt()` batches RC4 output
  instead of making one call per byte: a 48 MB PDF now takes under a second
  instead of running out of memory or taking tens of minutes, and
  `PDFWStreamForBuffer` no longer copies its whole contents on every write [#324](https://github.com/julianhille/MuhammaraJS/issues/324)
- Fix Recipe character-spacing measurements for retained boundary whitespace
  and non-BMP Unicode text, preventing incorrect wrapping and horizontal
  alignment [#543](https://github.com/julianhille/MuhammaraJS/issues/543)
- Prevent a crash or hang when `appendPDFPagesFromPDF()` fails on a modifying
  writer with a malformed source such as a PDF with a broken page tree
  [#769](https://github.com/julianhille/MuhammaraJS/issues/769)
- Fix the low-level drawing `type` declaration to accept the documented
  `null`, which ends the path without painting. The option is now the exported
  `DrawingPathType` (`"stroke" | "fill" | "clip" | null`) so unsupported paint
  modes stay a compile error instead of silently producing unpainted geometry
  [#760](https://github.com/julianhille/MuhammaraJS/issues/760)
- Correct `mergePDFPagesToPage()` callback types to allow no return value and expose their `globalThis` receiver [#756](https://github.com/julianhille/MuhammaraJS/issues/756)
- Prefer `getentropy()` for native Linux CSPRNG calls when OpenSSL is unavailable [#742](https://github.com/julianhille/MuhammaraJS/issues/742)
- Release copying contexts created by `PDFPageMergingHelper` after file- and
  stream-based merges instead of retaining their parser and source resources
  [#759](https://github.com/julianhille/MuhammaraJS/issues/759)
- Upgrade the shared PDF-Writer foundation to v4.9.1, fixing cleanup of failed
  writer dictionaries and related parser, encryption, and stream ownership
  defects on native and Wasm builds.
- Correct `PDFWriterToContinueOptions.log` typings to accept synchronous `ByteWriter` log streams as well as file paths [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
- Detach a `createWriterToContinue()` stream log target when the writer ends.
  The stream stayed installed in the shared trace after `end()` or `_abort()`
  released it, so the next warning from any reader or writer wrote through
  freed memory and terminated the process.
- Reject invalid TIFF color arrays before processing the image instead of
  continuing with fallback colors or terminating the process during conversion
  [#752](https://github.com/julianhille/MuhammaraJS/issues/752)
- Fix native documentation examples that could not run as written: `endPDF()`
  discarded the Recipe instance in the Add Clickable URL Links how-to because
  native `endPDF()` returns nothing without a callback; a migration-guide
  `text()` sample used an unregistered `layout` id; the Continuation State,
  Find Text Positions, and Modify PDFs guides reused a writer or reader an
  earlier code block had already ended or shut down
  [#740](https://github.com/julianhille/MuhammaraJS/issues/740)
- Finish an active Recipe page in `endPDF()` and `appendPage()` instead of
  writing a document without it. `createPage()` followed by `endPDF()` wrote a
  PDF with no page tree, and the same sequence with page content or an
  `appendPage()` threw `Unable to end PDF`. A page still open while pages are
  marked for deletion is still reported, before the Recipe is retired
  [#732](https://github.com/julianhille/MuhammaraJS/issues/732)
- Align Recipe text with `html: true` on the width it is drawn at instead of
  one space wider, so centered HTML lines no longer sit half a space and right
  aligned ones a full space left of the same text without `html`
  [#708](https://github.com/julianhille/MuhammaraJS/issues/708)
- Measure Recipe `textDimensions()` with the `fontSize` alias as well as
  `size`, matching `text()` and `@muhammara/wasm`, instead of silently
  measuring at the 14pt default
  [#733](https://github.com/julianhille/MuhammaraJS/issues/733)
- Break lines for `<br />` and uppercase `<BR>` in Recipe HTML text, not only
  `<br>` and `<br/>`, and drop the whitespace before a line break so aligned
  lines are not padded [#667](https://github.com/julianhille/MuhammaraJS/issues/667)
- Measure Recipe `table()` cells with `html: true` as HTML, so a cell with line
  breaks no longer overlaps the next row
  [#667](https://github.com/julianhille/MuhammaraJS/issues/667)
- Constrain Recipe text-markup annotations to the visible clipping region when
  using `textBox.wrap: "clip"`, so hidden text does not leave highlights or
  other review markup outside the box
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)

- Create Recipe text-markup annotations only for `highlight`, `underline`,
  `strikeOut`, and `squiggly` options that are enabled; `false` values no
  longer add an annotation
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Keep valid Recipe page numbers when adding pages to an existing document so
  annotations on those pages no longer fail during `endPDF()`
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Extend Recipe text-markup bounds across justified lines, including the expanded
  spaces, and start them at the drawn line for text with `opacity` or
  `rotation` instead of at the text box edge. The caller's markup options
  object is no longer modified [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Write Recipe annotation `title`, `subject`, contents, and rich text as PDF
  text strings, so non-ASCII characters no longer display as garbled UTF-8
  bytes in PDF viewers. A `0` or `false` title or subject is now written as
  `"0"`/`"false"` instead of an empty title
  [#716](https://github.com/julianhille/MuhammaraJS/issues/716)
- Write supplied rich text that starts with `<?xml` to the annotation instead
  of the string `true`
  [#716](https://github.com/julianhille/MuhammaraJS/issues/716)
- Stop Recipe `text()` with `html: true` from throwing when the HTML has text
  outside any element and no explicit `size`; that text now uses the default
  14pt size like element text
  [#704](https://github.com/julianhille/MuhammaraJS/issues/704)
- Constrain Recipe text links to their visible clipping region when using
  `textBox.wrap: "clip"`, so hidden overflow does not remain clickable outside
  the text box [#718](https://github.com/julianhille/MuhammaraJS/issues/718)
- Keep Recipe text links on their original page when an `overflow` callback
  changes pages or an `onClip` callback ends the page, instead of attaching
  links to a later page or throwing after the callback
  [#718](https://github.com/julianhille/MuhammaraJS/issues/718)
- Stop Recipe `table()` from throwing for empty `contents`, reusing a previous
  table's `overflow` callback, keeping the first page's bounds on a
  continuation, overlapping a continued row with its repeated header, drawing a
  zero-height border for an empty segment, and mutating `border` options.
  An `overflow` callback that ends the page without starting another now
  throws a clear `Error` instead of an internal `TypeError`
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Pass `""` instead of `null` to a table column `renderer` for null values, and
  leave the text cursor at the table's left edge and bottom
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Treat inherited record properties as missing table cells instead of
  rendering prototype methods such as `constructor` and `toString`
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Preserve `onClip` and other callback options set on a table, column, row, or
  header instead of silently discarding them while cloning options
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Stop a table's `overflow` callback from also running as the text-flow
  overflow callback while drawing a cell's text
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)

### Changed

- Declare `DocumentCopyingContext#getSourceDocumentParser()` without
  parameters in the TypeScript types, matching the runtime, which never used
  them [#320](https://github.com/julianhille/MuhammaraJS/issues/320)
- Throw `TypeError: No page is active; call createPage() or editPage()
first` from Recipe drawing and annotation methods called without a page,
  instead of a property-destructuring `TypeError` [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Link `bcrypt.lib` explicitly in the Windows native build, where OpenSSL seeds
  AES initialization vectors from `BCryptGenRandom`
  [#663](https://github.com/julianhille/MuhammaraJS/issues/663)
- Rework the npm READMEs of `@muhammara/native`, `@muhammara/native-with-source`, and `@muhammara/native-core`: each explains how the MuhammaraJS packages fit together, when to use the Wasm package instead, supported platforms, and tested quick-start examples [#772](https://github.com/julianhille/MuhammaraJS/issues/772)
- Build seven canonical native prebuilds and reuse them across supported Node.js
  and Electron compatibility-boundary tests, including native ARM64 musl tests
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
- Update GitHub Actions to their current releases to remove deprecated Node.js
  action runtimes [#700](https://github.com/julianhille/MuhammaraJS/issues/700)
- Declare native Recipe `fill()`, `stroke()`, and `fillAndStroke()` without a
  color parameter, matching the implementation, the "no effect" prose, and the
  WebAssembly declarations. The parameter existed only in `7.0.0-beta` and was
  never accepted at runtime; set colors through shape options such as
  `rectangle(x, y, w, h, { fill: "red" })`
  [#735](https://github.com/julianhille/MuhammaraJS/issues/735)

## [7.0.0-beta.3] - 2026-09-18

### Fixed

- Build and test the macOS arm64 binaries natively instead of cross-compiling
  them from an x64 Node. The arm64 matrix legs pinned an x64 host on Apple
  Silicon runners, so `npm run test`, `test:electron`, and the packaged-binary
  check were skipped for every arm64 target. Electron 38 and newer build no
  macOS x64 leg at all, so those prebuilds shipped without being executed once
  [#695](https://github.com/julianhille/MuhammaraJS/issues/695)
- Upload the GitHub release prebuilds before publishing to npm, and let a re-run
  on an existing tag finish a partial release. Prebuilds that share an asset
  name are de-duplicated before upload, a stuck draft release is completed, and
  an already-published npm version is skipped instead of failing the job with
  `You cannot publish over the previously published versions`
  [#696](https://github.com/julianhille/MuhammaraJS/issues/696)
- Mark alpha, beta, and release candidate GitHub releases as pre-releases. They
  were published as normal releases, so GitHub pointed its latest release at a
  prerelease tag [#696](https://github.com/julianhille/MuhammaraJS/issues/696)

## [7.0.0-beta.2] - 2026-09-14

### Breaking Changes

- Reject native `PDFWriter` stateful calls after `end()` or `shutdown()` with
  `Error("PDF writer has ended")`, including after finalization failures. Create
  a new writer, or resume saved state with `createWriterToContinue()`; direct
  `new PDFWriter()` instances cannot perform stateful operations
  [#693](https://github.com/julianhille/MuhammaraJS/issues/693)
- Make native Recipe `endPDF()` idempotent. Repeated calls no longer attempt to
  rewrite the completed PDF, while repeated `endPDF(callback)` calls still
  invoke the callback with the completed output where applicable. Create a new
  Recipe instead of calling `endPDF()` again to flush later changes
  [#693](https://github.com/julianhille/MuhammaraJS/issues/693)
- Retire native Recipe instances after any `endPDF()` failure and rethrow the
  original error on later calls. Code that retried the same Recipe must create a
  new instance instead [#381](https://github.com/julianhille/MuhammaraJS/issues/381)
- Count leading and trailing non-breaking spaces in native Recipe `charSpace`
  measurements, matching Wasm. Text can measure wider or wrap earlier; use
  regular boundary spaces when they should be trimmed. See
  [Migrate from v6 to v7](packages/native/docs/getting-started/migrate-from-v6.md#11-trim-boundary-non-breaking-spaces-from-charspace-text)
  [#661](https://github.com/julianhille/MuhammaraJS/issues/661)
- Native Recipe `appendPage()` now rejects zero, negative, fractional, reversed,
  and malformed page selections instead of clamping or partially interpreting
  them; pass positive one-based integers or ascending two-value ranges. Integer
  endpoints beyond the source still clamp to its final page
  [#548](https://github.com/julianhille/MuhammaraJS/issues/548)
- Native Recipe `insertPage()` now throws synchronously when `pdfSrc` or
  `srcPageNumber` is missing instead of silently queuing no insertion or failing
  later in `endPDF()`; pass all three arguments before continuing the Recipe
  chain [#548](https://github.com/julianhille/MuhammaraJS/issues/548)
- Native Recipe `pauseContext()` and `resumeContext()` now throw when there is
  no matching active or paused page content context instead of silently doing
  nothing. Call `pauseContext()` only after creating or editing a page, and call
  `resumeContext()` exactly once after a successful pause
  [#608](https://github.com/julianhille/MuhammaraJS/issues/608)
- Native Recipe `endPage()` now clears the completed page and its content
  context instead of leaving them active. Code that called page drawing,
  configuration, or context methods after `endPage()` now fails; call
  `createPage()` or `editPage()` before the next page operation. See
  [Migrate from v6 to v7](packages/native/docs/getting-started/migrate-from-v6.md#9-reactivate-pages-after-endpage)
  [#608](https://github.com/julianhille/MuhammaraJS/issues/608)
- Remove the accidentally exposed native `Recipe` prototype members
  `ANNOTATION_PREFIX`, `appendPDFPageFromPDFWithAnnotations()`, and
  `appendPDFPagesFromPDFWithAnnotations()`. Code that called these undocumented
  internal helpers now fails; use `appendPage()`, `insertPage()`, or `split()`
  for supported page-copying operations [#623](https://github.com/julianhille/MuhammaraJS/issues/623)
- The native `PDFReader` methods that take a page index or object ID —
  `parseNewObject()`, `getPageObjectID()`, `parsePageDictionary()`,
  `parsePage()`, `extractPageText()`, `extractPageContentItems()`, and
  `getXrefEntry()` — now throw a `TypeError` instead of coercing the argument.
  `reader.parsePage(-1)`, which used to read page 4294967295, and
  `reader.extractPageText(1.5)`, which used to read page 1, now fail with
  `Page index must be a non-negative integer`; pass a non-negative integer below
  2^32 [#581](https://github.com/julianhille/MuhammaraJS/issues/581)
- Native `Recipe.setPageBox()` now requires an `ePDFPageBox*` constant instead
  of a string box name. Calls such as `setPageBox("crop", ...)` now fail; pass
  `muhammara.ePDFPageBoxCropBox` instead
  [#619](https://github.com/julianhille/MuhammaraJS/issues/619)
- Remove native `Recipe.fillOpacity()`. Calls now fail; use `Recipe.opacity()`
  to set both fill and stroke alpha. Opacity persists for later vector drawing,
  so call `opacity(1)` to restore opaque output. See [Migrate from v6 to v7](packages/native/docs/getting-started/migrate-from-v6.md#8-replace-recipefillopacity)
  [#618](https://github.com/julianhille/MuhammaraJS/issues/618)
- Tighten native Recipe TypeScript declarations and add named types for
  metadata, HTML text objects, colors, permissions, registered extensions,
  layouts, tables, text boxes, markup, and vector shapes. Existing TypeScript
  code that relies on `Function`, unchecked option literals, `object[]` rows,
  unknown table fields, unsupported callback returns, widened vector styles,
  broad strings for finite values, or an unconditional
  `recipe.metadata.pages` may now fail `tsc`; use the corresponding
  `muhammara.Recipe` types, return documented callback instructions, and check
  the optional `pages` or `pageCount` counter. See
  [Migrate from v6 to v7](packages/native/docs/getting-started/migrate-from-v6.md#10-update-recipe-types)
  [#654](https://github.com/julianhille/MuhammaraJS/issues/654)

### Added

- Add Recipe URL links for arbitrary areas, rendered text, images, and drawing
  bounds [#614](https://github.com/julianhille/MuhammaraJS/issues/614)
- Document native writer encryption, reader passwords, continuation state, and
  previously undocumented public low-level exports
  [#629](https://github.com/julianhille/MuhammaraJS/issues/629)
- Link native package READMEs and previously orphaned executable examples to
  their documentation, and document pnpm 10 installation approval
  [#630](https://github.com/julianhille/MuhammaraJS/issues/630)
- Add chainable native Recipe `deletePage()` support for removing one or more
  pages from an existing PDF while preserving retained page objects
  [#548](https://github.com/julianhille/MuhammaraJS/issues/548)
- Add `Recipe.rotate()` to set `/Rotate` on the current native Recipe page,
  including pages created with explicit dimensions, matching Wasm Recipe
  [#620](https://github.com/julianhille/MuhammaraJS/issues/620)
- Add native Recipe `rotateContent()` for rotating subsequent drawing around a
  point, matching Wasm [#616](https://github.com/julianhille/MuhammaraJS/issues/616)
- Add native Recipe `pie()` for closed, fillable arc wedges, matching Wasm
  [#615](https://github.com/julianhille/MuhammaraJS/issues/615)
- Add `Recipe.getCurrentPageInfo()` for the geometry of the active native
  Recipe page, matching the Wasm API
  [#621](https://github.com/julianhille/MuhammaraJS/issues/621)
- Add Recipe `opacity()` for fill and stroke alpha
  [#618](https://github.com/julianhille/MuhammaraJS/issues/618)
- Add native Recipe `lineStyle()` with Wasm-compatible width, cap, join, miter,
  and dash options [#617](https://github.com/julianhille/MuhammaraJS/issues/617)
- Add native Recipe `link()` with the top-left coordinate signature already
  available in Wasm [#614](https://github.com/julianhille/MuhammaraJS/issues/614)
- Support native Recipe `annot()` opacity and `comment()` replies, including
  TypeScript options, matching Wasm annotation dictionaries
  [#606](https://github.com/julianhille/MuhammaraJS/issues/606)
- Document native Recipe's bundled fonts and zero-setup text, including the
  default-font difference from Wasm Recipe
  [#613](https://github.com/julianhille/MuhammaraJS/issues/613)
- Document watermarking a PDF in place and watermarking a `Buffer`, including
  the overwrite, incremental-update, and buffer-mode caveats
  [#297](https://github.com/julianhille/MuhammaraJS/issues/297)
- Document adding standard and custom Info dictionary metadata, including
  dotted OID keys, to an existing PDF, and the lower-cased read-back, dropped
  custom entries, and stamped provenance that come with it
  [#450](https://github.com/julianhille/MuhammaraJS/issues/450)
- Document editing and removing an annotation that already exists in a PDF,
  with a runnable `edit-annotation` example executed by the documentation test
  suite [#385](https://github.com/julianhille/MuhammaraJS/issues/385)
- Add `PDFReader.extractPageContentItems()` for detecting page-marking content operations [#275](https://github.com/julianhille/MuhammaraJS/issues/275)
- Add an optional `limits` argument to `PDFReader.extractPageText()` and
  `PDFReader.extractPageContentItems()`, matching the Wasm reader. Requests are
  clamped to the built-in ceilings, so a caller can tighten the extraction
  budget but never raise it [#275](https://github.com/julianhille/MuhammaraJS/issues/275)
- Document the extraction budget and `PDFReader.extractPageContentItems()` in
  the reader API, low-level reading, and text-position guides
  [#275](https://github.com/julianhille/MuhammaraJS/issues/275)
- Add runnable `detect-blank-pages` and `find-text-positions` documentation
  examples, executed by the documentation test suite
  [#275](https://github.com/julianhille/MuhammaraJS/issues/275)
- Accept PDF 2.0 in `Recipe` options for both the native and Wasm packages.
  `version: 2.0` (and the `20` enum in the Wasm package) now writes a PDF 2.0
  header instead of falling back to 1.7, the Wasm `RecipePDFVersion` type
  includes it, and unsupported values still fall back to 1.7.

### Fixed

- Stop native `createPDFDate()`, `setCreationDate()`, and `setModDate()` from
  aborting the process on a rejected argument. They threw a `TypeError` and then
  constructed a `PDFDate` anyway, which is fatal on Node.js 20 and older because
  the pending exception makes `NewInstance()` return empty. They now raise the
  `TypeError` on its own. `createPDFDate()` without an argument keeps returning
  an empty date, matching the `PDFDate` constructor and the Wasm writer
  [#693](https://github.com/julianhille/MuhammaraJS/issues/693)
- Widen the native `createPDFDate()` typing to the `string | Date` argument it
  has always accepted, matching the Wasm declaration
  [#693](https://github.com/julianhille/MuhammaraJS/issues/693)
- Prevent native writer and copying-context use-after-end crashes by guarding
  stateful entry points and tying copying contexts to their writer lifecycle
  [#693](https://github.com/julianhille/MuhammaraJS/issues/693)
- Preserve embedded NUL bytes in the native low-level `TJ()`, `Tj()`, `Quote()`,
  and `DoubleQuote()` strings instead of silently truncating each string at the
  first NUL [#683](https://github.com/julianhille/MuhammaraJS/issues/683)
- Honour the native low-level text `encoding` option. An inverted string
  comparison swapped `"hex"` and `"code"` and turned `"text"` into `"hex"`, so
  `Tj()`, `Quote()`, `DoubleQuote()`, and `TJ()` wrote the wrong PDF string type
  for every explicit encoding. They now match the Wasm package: `"hex"` writes a
  hex string, `"code"` a literal string, and `"text"` the font-encoded default
  [#683](https://github.com/julianhille/MuhammaraJS/issues/683)
- Release native writer stream proxies and mark the writer ended when finalization
  fails, so a later `end()` call does not re-enter finalization [#677](https://github.com/julianhille/MuhammaraJS/issues/677)
- Report the correct native text-to-page matrix after text-positioning and `cm`
  operations while extracting page text
  [#673](https://github.com/julianhille/MuhammaraJS/issues/673)
- Prevent native PDF readers and copying contexts from terminating Node.js when
  used after `end()`; affected calls now throw an ended-state error
  [#668](https://github.com/julianhille/MuhammaraJS/issues/668)
- Prevent native text extraction from reporting inline-image payload bytes as
  fabricated page text [#670](https://github.com/julianhille/MuhammaraJS/issues/670)
- Render one correctly indented marker per native Recipe list item across
  formatting, block children, nested lists, and explicit line breaks; keep
  internal break artifacts out of layout and clipping; and count indentation
  once during wrapping
  [#661](https://github.com/julianhille/MuhammaraJS/issues/661)
- Fix native `Recipe.lineWidth()` to apply its width to subsequent lines,
  matching Wasm [#617](https://github.com/julianhille/MuhammaraJS/issues/617)

- Preserve custom Info dictionary keys passed to native `Recipe.info(options)`,
  matching Wasm, instead of silently discarding them; `custom(key, value)` remains
  the explicit spelling [#607](https://github.com/julianhille/MuhammaraJS/issues/607)

- Actually build and publish the Electron 38.2 through 44.0 prebuilds announced
  in 7.0.0-beta.1. The build matrix was lost when the branch was rebased across
  the native/Wasm workflow split, so `ci-native.yml` only ever built Electron
  36.0 through 38.1 [#537](https://github.com/julianhille/MuhammaraJS/issues/537)
- Release the source PDF file handle that `Recipe` holds, so the source,
  appended, and overlaid files can be deleted right after `endPDF()` instead of
  failing with `EBUSY` on Windows [#381](https://github.com/julianhille/MuhammaraJS/issues/381)
- Release the file handles `Recipe#appendPage()` opens when the appended PDF
  cannot be read or a page cannot be copied, instead of leaking them for the
  life of the process [#381](https://github.com/julianhille/MuhammaraJS/issues/381)
- Abort the native Recipe writer and release its source reader after every
  `endPDF()` failure, so a non-deletion failure no longer retains file handles
  on Windows [#381](https://github.com/julianhille/MuhammaraJS/issues/381)
- Update `mkdocs-material` to 9.7.7 for the DOM XSS security vulnerability fix
  in search suggestions, bringing the native documentation build back in line
  with the Wasm one [#600](https://github.com/julianhille/MuhammaraJS/issues/600)
- Override `serialize-javascript` to 7.1.1 for the remote code execution and
  CPU exhaustion security vulnerability fixes, since Mocha still resolves the
  6.x line [#600](https://github.com/julianhille/MuhammaraJS/issues/600)

### Changed

- Build only the newest Electron patch release in each supported minor so
  equivalent prebuilds no longer consume duplicate CI jobs and release assets
  [#748](https://github.com/julianhille/MuhammaraJS/issues/748)
- Make documentation self-contained with inline text-extraction and annotation
  examples, replacing links to tests, implementation files, and GitHub releases
  [#689](https://github.com/julianhille/MuhammaraJS/issues/689)
- Validate that the native GYP and Wasm CMake builds compile the same PDFWriter
  translation units, preventing either backend from silently omitting new source
  files [#684](https://github.com/julianhille/MuhammaraJS/issues/684)
- Publish all three native npm packages before creating the GitHub release, so a
  failed npm publication does not leave an orphan release
  [#684](https://github.com/julianhille/MuhammaraJS/issues/684)
- Document the complete set of Perl packages RPM-based distributions need for a
  source build. The list grew from `perl-FindBin` and `perl-IPC-Cmd` to also
  cover `perl-lib`, `perl-File-Compare`, `perl-File-Copy`, `perl-Time-Piece`,
  and `perl-Digest-SHA`, each verified as blocking on a clean Fedora container.
  The development guide now states the prerequisites where it tells contributors
  to run `npm ci`, and the source-capable package README links to the
  installation page instead of repeating a list that had already drifted
  [#596](https://github.com/julianhille/MuhammaraJS/issues/596)
- Make native Recipe `register()`, `pauseContext()`, and `resumeContext()`
  chainable, and track created-page and edited-page context transitions
  [#608](https://github.com/julianhille/MuhammaraJS/issues/608)
- Document that native writer events have no WebAssembly equivalent
  [#624](https://github.com/julianhille/MuhammaraJS/issues/624)
- Declare documented native Recipe metadata and call forms in TypeScript,
  including font styles, overlay shortcuts, flowing text, and centered text and
  images [#628](https://github.com/julianhille/MuhammaraJS/issues/628)
- Correct native Recipe TypeScript declarations for text style and image transformation options [#625](https://github.com/julianhille/MuhammaraJS/issues/625)
- Build Linux prebuilds against the Debian archive now that Debian 11
  bullseye is end of life [#577](https://github.com/julianhille/MuhammaraJS/issues/577)
- Force the packaged-source Electron rebuild check in CI to build from source.
  Once a release carries matching prebuilds, `electron-rebuild` downloads one
  and reports success without compiling, so the job stopped exercising the
  source-build path it exists to cover
  [#603](https://github.com/julianhille/MuhammaraJS/issues/603)
- `PDFReader.extractPageText()` now throws `Error` rather than `TypeError` when
  a page exceeds the extraction budget, matching the Wasm reader.
- Correct the `parsePageDictionary()` and `parsePage()` type declarations to
  name their argument `pageIndex`; both have always taken a page index, not an
  object id.
- Correct the contributing guide's documentation-example test path, which named
  a directory that does not exist.
- Store every text file with LF line endings, enforced by `.gitattributes` and
  checked in CI. Vendored PDFWriter sources and PDF fixtures keep their bytes
  untouched.
- Set the `Creator` Info entry that `Recipe` writes to
  `Muhammara-Recipe (https://github.com/julianhille/MuhammaraJS)`, replacing the
  inherited `Hummus-Recipe` value. PDFs edited with `Recipe` still record the
  source document's own creator as `source-Creator`.
- Drop the Node.js compatibility fallbacks in `src/nodes.h` for versions below
  the supported floor: the io.js 2.5 instance creation and numeric
  conversions, the pre-Node-10 non-context-aware conversions, and the
  non-context-aware module and `ConstructorsHolder` singleton path. The Node 20
  accessor branch and the `HolderV2()` property-holder branch stay
  [#553](https://github.com/julianhille/MuhammaraJS/issues/553)

## [7.0.0-beta.1] - 2026-09-05

### Added

- Add `PDFWriter.replaceObject()` for page-scoped indirect object replacement, with optional global scope [#315](https://github.com/julianhille/MuhammaraJS/issues/315)
- Add `Recipe.replaceText()` for replacing literal text in a page content stream [#315](https://github.com/julianhille/MuhammaraJS/issues/315)
- Add Electron 38.x through 44.x build targets [#537](https://github.com/julianhille/MuhammaraJS/issues/537)

### Fixed

- Generate native API reference pages during Read the Docs builds and cache the
  native addon used to validate executable documentation examples [#566](https://github.com/julianhille/MuhammaraJS/issues/566)
- Build current Electron versions with V8 external pointer tags [#537](https://github.com/julianhille/MuhammaraJS/issues/537)

### Changed

- Skip native package CI for documentation-only changes; Documentation CI
  validates those updates.

## [7.0.0-alpha.1] - 2026-09-04

### Breaking Changes

- Replace the unscoped `muhammara` package with `@muhammara/native` or
  `@muhammara/native-with-source`. Existing `require("muhammara")` imports must
  change, or the source-capable package must be installed with the documented npm
  alias.
- `@muhammara/native` is prebuilt-only. A missing compatible prebuilt now fails
  installation instead of compiling locally; install
  `@muhammara/native-with-source` for source and Electron builds.
- Windows win32 (32-bit) prebuilds and build tooling are no longer supported.

### Added

- Publish the shared `@muhammara/native-core` runtime, prebuilt-only
  `@muhammara/native`, and source-capable `@muhammara/native-with-source`
  packages, with npm alias support for existing imports.
- Add `muhammara-clean-source` to remove bundled C++ sources after a successful
  native build.
- Set version of setup-node action to v6
- Set version of checkout action to v6
- Set version of cache action to v5
- Add missing type definitions for PDFReader methods and PDFObjectParser interface [#479](https://github.com/julianhille/MuhammaraJS/issues/479)
- node version 25
- Add Node.js 26 support [#516](https://github.com/julianhille/MuhammaraJS/issues/516)
- Add context opacity support for transparent text [#496](https://github.com/julianhille/MuhammaraJS/issues/496)
- New version of PDF Writer 4.8.1
- New version of PDF Writer 4.9.0 [#534](https://github.com/julianhille/MuhammaraJS/issues/534)
- Expose PDF 2.0 writer support [#551](https://github.com/julianhille/MuhammaraJS/issues/551)
- Add `PDFReader.extractPageText()` for enumerating page content-stream text operations.
- Add opt-in fixed-height clipping and an `onClip` callback to Recipe text boxes
- Bundle pinned OpenSSL 3.5.4 statically in official native prebuilts.
- Speed up native source builds with parallel compilation and ccache-backed CI caches [#562](https://github.com/julianhille/MuhammaraJS/issues/562)

### Fixed

- Release xref streams and their Flate buffers after writing.
- Release previous-xref trailers and filter readers on parser failure.
- Close copied stream dictionaries and combined page-tree objects on failure.
- Correct CFF array deallocation and harden Type 1 decoder arithmetic.
- Release addon constructors deterministically during Node environment cleanup.
- Add native sanitizer coverage for lifecycle cleanup.
- Release PDF readers in documentation tests to prevent Windows file-lock cleanup failures.
- Remove the duplicate documentation example test from the documentation CI workflow.
- Prevent a segmentation fault when `endPDF()` is called more than once.
- Update macOS runner from macos-13 to macos-14
- Fix DictionaryContext.writeKey() signature to include required key parameter [#479](https://github.com/julianhille/MuhammaraJS/issues/479)
- Memory leak, by improper addition of document context extender instead of removal
- Update dependencies
- Prevent JS stream readers from overflowing native buffers [#518](https://github.com/julianhille/MuhammaraJS/issues/518)
- Replace deprecated node-pre-gyp URL APIs to remove Node.js 24 warnings by updating node-pre-gyp [#508](https://github.com/julianhille/MuhammaraJS/issues/508)

### Removed

- Future publication of the unscoped `muhammara` package; published versions
  are deprecated in favor of the scoped native packages.
- node version 18
- node version 19
- node version 21
- node version 23
- Windows win32 (32-bit) build system and binaries; we no longer publish 32-bit artifacts

## [6.0.6] - 2026-08-22

### Fixed

- Update the tar override to 7.5.22 for security vulnerability fixes.
- Use the lockfile's Prettier version in the CI lint job.
- Update brace-expansion to 2.1.4 for security vulnerability fixes.
- Update diff to 5.2.2 for security vulnerability fixes.
- Update js-yaml to 4.3.1 for security vulnerability fixes.
- Update linkify-it to 5.0.2 for security vulnerability fixes.
- Update lodash to 4.18.1 for security vulnerability fixes.
- Update markdown-it to 14.3.0 for security vulnerability fixes.
- Update picomatch to 2.3.2 for security vulnerability fixes.
- Update underscore to 1.13.8 for security vulnerability fixes.
- Default missing Crypt filter parameters to Identity to fix GHSA-ch7g-v45m-q27g and GHSA-7xrh-8x56-r797.

## [6.0.5] - 2026-05-21

### Fixed

- Update xmldom to 0.9.10 to address cve issue
- Update node-tar to 7.5.15 to address cve issue
- Update minimatch to 9.0.9 to address cve issue
- Fix GHSA-fhp4-pr5j-46m5 DOS issue in PDF Writer

## [6.0.4] - 2026-02-25

### Fixed

- Raise node-tar override to 7.5.9 for the recurring security vulnerability fix.

## [6.0.3] - 2026-01-29

### Fixed

- Update tar version to 7.5.7 in overrides for security vulnerability fix.

## [6.0.2] - 2026-01-22

### Fixed

- Missing package update to the tar overrides to finally fix the vulnaribility.

## [6.0.1] - 2026-01-21

DEPRECATED.

This version does not fix the tar vulnaribility as it misses
the package-lock.json update and so will be replaced with 6.0.2

### Fixed

- Force tar to >=7.5.4 to fix security vulnaribility by removing
  npm dependency and updating node-pre-gyp to compatible version

## [6.0.0] - 2025-09-23

### Added

- Current supported electron versions (36.x, 37.x, 38.x)

### Removed

- Outdated and EOL versions of nodejs (17, 18)
- All electron versions current supported editions (<36.x>)

### Fixed

- Update node-pre-gyp and brace to remove security concerns
- Update npm version to support newer node-pre-gyp

## [5.4.0] - 2025-09-21

### Added

- Add node v24.0.0

## [5.3.0] - 2024-12-14

### Added

- Add electron 31.7.0, 33.1.0, 33.2.0, 33.3.0 [#439](https://github.com/julianhille/MuhammaraJS/issues/439)

### Fixed

- Fix recipe with new buffers [#372](https://github.com/julianhille/MuhammaraJS/issues/372)
- Wrong node versions for 2.2, 32.1 and 31.6 [#439](https://github.com/julianhille/MuhammaraJS/issues/439)
- Fix recipes createPage typescript definition and jsdoc, discourage
  use of '-size' values for pageType [#369](https://github.com/julianhille/MuhammaraJS/issues/369)

## [5.2.0] - 2024-10-20

### Added

- Add electron 33.0, 32.1, 32.2, 31.5, 31.6, 30.5

## [5.1.0] - 2024-10-17

### Added

- Add node v23.0.0

### Updated

- Downgrade to gcc11 to lower needed glibc version

## [5.0.2] - 2024-10-10

### Added

- Update PDRWriter to 4.6.7 (#410)

### Update

- Build linux on docker -> downgrade glibc for linux builds (#423)

## [5.0.1] - 2024-09-28

### Added

- Tests for bold, italic, underline, strikethrough, and highlights in textboxes
- Add missing node v21 and v22 to the build matrix (#417)

## [5.0.0] - 2024-09-08

### Added

- Add electron 24.7 and 24.8
- Add electron 25.4, 25.5, 25.6, 25.7, 25.8 and 25.9
- Add electron 26.0, 26.1, 26.2, 26.3, 26.4, 26.5, 26.6
- Add electron 27.0, 27.1, 27.2 and 27.3
- Add electron 28.0, 28.1, 28.2 and 28.3
- Add electron 29.0, 29.1, 29.2, 29.3 and 29.4
- Add electron 30.0, 30.1, 30.2, 30.3 and 30.4
- Add electron 31.0, 31.1, 31.2, 31.3 and 31.4
- Add electron 32.0
- Add node v22.0.0

### Remove

- Outdated electron 23.x versions
- Node version <= 16

### Update

- Update dependencies
  - Including tar which removes a security vulnerability
- new Buffer to Buffer.from

## [4.1.0] - 2023-12-13

### Fixed

- definitions: appendPage optionnal parameter
- Build musl/musl-arm with node 20
- Support negative rotation in recipe page changes
- registerFont now returns recipe as stated in typescript definition

### Added

- Add nodejs v21.0.0

## [4.0.0] - 2023-07-14

### Fixed

- Recipe type / arg documentation
- Add missing type `userPassword` to `EncryptOptions`
- Underline in text object

### Added

- Add electron 23.2., 23.3
- Recipe infos to readme
- Strikethrough implementation in text object
- Electron v24.1, 24.2, 24.3, 24.4, 24.5, 24.6
- Add node 20.x
- Add electron v25.0, 25.1, 25.2, 25.3
- Option to add annotation replies to annotations
- Textboxes now show title and date as annotations in pdfs

### Removed

- Dependency to static-eval and static-module as they are not used directly
- Node versions: 11.x - 14.x
- Electron versions: 11.x - 14.2

### Changed

- Updated node-gyp version to 1.0.10
- Older node ubuntu 18.04 builds are now building on docker, as github actions removed 18.04
- CI linux builds use ubuntu 20.04 instead of 18.04 -> glibc Update, see readme for breaking changes in v4

## [3.8.0] - 2023-03-01

### Added

- Electron 22.3, 23.0.0, 23.1.1

### Fixed

- Correctly includes types file in package

## [3.7.0] - 2023-02-09

### Added

- Electron 21.4, 22.1 and 22.2

### Fixed

- Update xmldom to new 0.8.6 and fix security issues
- Fix arm64 on mac builds

### Removed

- Pre-builts for macos on arm for node < 15 (eg 14, 12, 10 etc)

## [3.6.0] - 2023-01-24

### Added

- Pre builts for arm64 / musl architecture (M1 using alpine)
- Hummus-recipe / Muhammara-recipe as part of this lib

### Fixed

- Memory leak in ByteReaderWithPositionDriver when reading PDF files

## [3.5.0] - 2022-12-07

### Added

- Electron 22.0.x

## [3.4.0] - 2022-11-24

### Added

- Electron 21.3.x

### Fixed

- Several cases of NPE under different circumstances

## [3.3.0] - 2022-11-05

### Fixed

- Typescript definition of member buffer of PDFWStreamForBuffer fixed

### Changed

- Updated github actions to get rid of some deprecation warnings in gha ci
- Pin python 3 version for builds

### Added

- Electron 21.0.0, 21.1.0 and 21.2.0

## [3.2.0] - 2022-10-26

### Added

- Add electron 20.3.3
- Ignore extra data above the header and below the footer in PDF Parser
- Add node 19.0.0

## [3.1.1] - 2022-10-23

### Fixed

- NPE in parser when file ends before it really starts

## [3.1.0] - 2022-09-30

### Changed

- Update TypeScript declaration for `PDFStreamForResponse` to accept any writable stream as an argument, not just `PDFRStreamForFile`

### Added

- Electron 21.0
- Node 18
- Electron 20.0, 20.1, 20.2
- Prettier as dev dependency and basics
- Electron 19.1

## [3.0.0] - 2022-07-19

### Fixed

- Links in docs

### Added

- drawPath can now be used differently and this new way can be described with ts.
  The old style is `drawPath(x1, y1, x2, y2..., options)` we now allow `drawPath([[x1, y1], [x2, y2]...], options)` too
- scn and SCN can now be used differently and this new way can be described with ts.
  The old style is `scn(c1, c2, c3, c4, ..., 'patternName')` we now allow `scn([[c1, c2, c3, c4, ...], 'patternName')` too

### Changed

- Bump dev dependency versions s

### Breaking

- Node < 11 and Electron < 11 removed
- Renamed typo exported value from eTokenSeprator to eTokenSeparator

## [2.6.2] - 2022-11-23

### Fixed

- Several cases of NPE under different circumstances

## [2.6.1] - 2022-10-23

### Fixed

- Backport: NPE in parser when file ends before it really starts

## [2.6.0] - 2022-06-30

### Changed

- Fixes hard crash to exception when creating a stream with null object and calling createWriter with it
- Fixes missing buffer information for recrypt typescript definition
- Fixes missing options for append pdf pages
- Fixes NPE when stream is not readable in write stream object (PDFDocumentHandler)

## [2.5.0] - 2022-06-23

### Added

- Electron 17.2.0, 17.3, 17.4
- Typescript definitions
- Add test for recrypt with streams

## [2.4.0] - 2022-06-08

### Added

- Electron 18.1, 18.2, 18.3
- Electron 19.0

### Changed

- Update npm dist url to the new url for electron builds

## [2.3.0] - 2022-05-04

### Added

- Builds for node and electron with arm64 on darwin (Apple M1)
- Add electron 18

## [2.2.0] - 2022-03-05

### Changed

- Update PDFWriter dependency to the newest available versoin

### Added

- Electron version: 17.0, 17.1
- NodeJs 17.6.0

## [2.1.0] - 2021-12-03

### Added

- Electron versions: 16.0, 15.3, 15.2, 14.2, 13.6, 13.3

## [2.0.0] - 2021-10-22

### Removed

- Electron 2.0.7
- Node 6.14.1 and 7.10.1

### Added

- Add Electron 13.3.0
- Documentation (copy of the wiki)
- Add Electron 13.2.3
- Add Electron 13.5.0
- Add Electron 14.0.1
- Add Electron 14.1.0
- Add Electron 15.0.0
- Add Electron 15.1.2
- Add Node 16.11.1

### Fixed

- Dependency to node-pre-gyp moved from deprecated to scoped package

## [1.10.0] - 2021-07-12

### Added

- Add Electron 13.1
- Disable NEON on arm builds

## [1.9.0] - 2021-06-30

### Fixed

- Yarn v2 incompatibiliy
- Build issues on mac OS big sur

## [1.8.0] - 2021-05-28

### Added

- Add Electron 13.0
- Add missing typescript declaration of the PDFWStreamForBuffer
- Add Electron 11.4
- Add electron 10.4

## [1.7.0] - 2021-03-08

### Added

- More electron 11.x releases
- Add electron 12.0.0
- Add electron 10.2, 10.3
- Add electron 9.4, 9.3

## [1.6.0] - 2021-02-17

### Fixed

- Update the g++ compiler from 4.8 to 5.4 (default on xenial) for linux builds
- Changed builds from travis and app veyor to github

### Added

- Electron 11
- Added Node 15

## [1.5.1] - 2020-10-10

### Added

- Added manual workflow to reduce release errors

### Fixed

- Huge package size as npm publish does not use .gitignore or .npmignore locally

## [1.5.0] - 2020-10-10

### Added

- Electron 7.3, 8.3, 8.4, 8.5 and 9.3

## [1.4.3] - 2020-10-09

### Fixed

- Return code fixed for builds on app veyor.
- Winwdows builds successfully with electron 10.x
- NPM version on app veyor fixed to build electron 2.x again

### Added

- Add electron 10.1.3

## [1.4.2] - 2020-08-27

### Added

- Add electron 10.0

## [1.4.1] - 2020-08-13

This is a special release no code has been changed.
The packaged module included (in version muhammara@1.4.0) a bundled dependency with a
debug output.

### Fixed

- Removed debug output from packaged dependency `node-pre-gyp`

## [1.4.0] - 2020-08-10

### Added

- Add electron 9.2

## [1.3.0] - 2020-08-06

### Added

- Add electron-9.1 pre built

### Fixed

- Add missing typescript declaration files to published packages

## [1.2.0] - 2020-06-01

### Fixed

- Updated freetype to 2.10.0
- Updated libpng dependency to 1.6.37
- Updated libaesgm dependency
- Update libjpeg dependency to 9d
- Updated libtiff dependency to 3.9.7

## [1.1.0] - 2020-05-27

### Added

- Added infos about being hummusjs drop in replacement
- Added electron v9.0.0

### Fixed

- Updated dependencies and dev dependencies

## [1.0.1] - 2020-05-08

### Fixed

- Fixed readme to include infos about muhammaraJS and hummus
- Fixed node-pre-gyp binary download links

### Removed

- Unecessary dependency on aws-sdk

## [1.0.0] - 2020-05-07

Basically this is [HummusJS v1.0.108](https://github.com/galkahana/HummusJS/commit/772bd561f02433bf1a602135f53c7c17f8072450)
with the following changes.

### Added

- Store releases @github
- Listen for tags instead of a commit message
- Added node v13, v14, electron 6.1, 7.1, 7.2, 8.0, 8.1, 8.2

### Fixed

- Updated v8:GET / v8:SET calls which are incompatible with newer node version (>13)

### Removed

- Dropped support for electron 1.8

- Initial release

[unreleased]: https://github.com/julianhille/MuhammaraJS/compare/native-v7.0.0-beta.3...HEAD
[7.0.0-beta.3]: https://github.com/julianhille/MuhammaraJS/compare/native-v7.0.0-beta.2...native-v7.0.0-beta.3
[7.0.0-beta.2]: https://github.com/julianhille/MuhammaraJS/compare/native-v7.0.0-beta.1...native-v7.0.0-beta.2
[7.0.0-beta.1]: https://github.com/julianhille/MuhammaraJS/compare/native-v7.0.0-alpha.1...native-v7.0.0-beta.1
[7.0.0-alpha.1]: https://github.com/julianhille/MuhammaraJS/compare/6.0.6...native-v7.0.0-alpha.1
[6.0.6]: https://github.com/julianhille/MuhammaraJS/compare/6.0.5...6.0.6
[6.0.5]: https://github.com/julianhille/MuhammaraJS/compare/6.0.4...6.0.5
[6.0.4]: https://github.com/julianhille/MuhammaraJS/compare/6.0.3...6.0.4
[6.0.3]: https://github.com/julianhille/MuhammaraJS/compare/6.0.2...6.0.3
[6.0.2]: https://github.com/julianhille/MuhammaraJS/compare/6.0.1...6.0.2
[6.0.1]: https://github.com/julianhille/MuhammaraJS/compare/6.0.0...6.0.1
[6.0.0]: https://github.com/julianhille/MuhammaraJS/compare/5.4.0...6.0.0
[5.4.0]: https://github.com/julianhille/MuhammaraJS/compare/5.3.0...5.4.0
[5.3.0]: https://github.com/julianhille/MuhammaraJS/compare/5.2.0...5.3.0
[5.2.0]: https://github.com/julianhille/MuhammaraJS/compare/5.1.0...5.2.0
[5.1.0]: https://github.com/julianhille/MuhammaraJS/compare/5.0.2...5.1.0
[5.0.2]: https://github.com/julianhille/MuhammaraJS/compare/5.0.1...5.0.2
[5.0.1]: https://github.com/julianhille/MuhammaraJS/compare/5.0.0...5.0.1
[5.0.0]: https://github.com/julianhille/MuhammaraJS/compare/4.1.0...5.0.0
[4.1.0]: https://github.com/julianhille/MuhammaraJS/compare/4.0.0...4.1.0
[4.0.0]: https://github.com/julianhille/MuhammaraJS/compare/3.8.0...4.0.0
[3.8.0]: https://github.com/julianhille/MuhammaraJS/compare/3.7.0...3.8.0
[3.7.0]: https://github.com/julianhille/MuhammaraJS/compare/3.6.0...3.7.0
[3.6.0]: https://github.com/julianhille/MuhammaraJS/compare/3.5.0...3.6.0
[3.5.0]: https://github.com/julianhille/MuhammaraJS/compare/3.4.0...3.5.0
[3.4.0]: https://github.com/julianhille/MuhammaraJS/compare/3.3.0...3.4.0
[3.3.0]: https://github.com/julianhille/MuhammaraJS/compare/3.2.0...3.3.0
[3.2.0]: https://github.com/julianhille/MuhammaraJS/compare/3.1.1...3.2.0
[3.1.1]: https://github.com/julianhille/MuhammaraJS/compare/3.1.0...3.1.1
[3.1.0]: https://github.com/julianhille/MuhammaraJS/compare/3.0.0...3.1.0
[3.0.0]: https://github.com/julianhille/MuhammaraJS/compare/2.6.2...3.0.0
[2.6.2]: https://github.com/julianhille/MuhammaraJS/compare/2.6.1...2.6.2
[2.6.1]: https://github.com/julianhille/MuhammaraJS/compare/2.6.0...2.6.1
[2.6.0]: https://github.com/julianhille/MuhammaraJS/compare/2.5.0...2.6.0
[2.5.0]: https://github.com/julianhille/MuhammaraJS/compare/2.4.0...2.5.0
[2.4.0]: https://github.com/julianhille/MuhammaraJS/compare/2.3.0...2.4.0
[2.3.0]: https://github.com/julianhille/MuhammaraJS/compare/2.2.0...2.3.0
[2.2.0]: https://github.com/julianhille/MuhammaraJS/compare/2.1.0...2.2.0
[2.1.0]: https://github.com/julianhille/MuhammaraJS/compare/2.0.0...2.1.0
[2.0.0]: https://github.com/julianhille/MuhammaraJS/compare/1.10.0...2.0.0
[1.10.0]: https://github.com/julianhille/MuhammaraJS/compare/1.9.0...1.10.0
[1.9.0]: https://github.com/julianhille/MuhammaraJS/compare/1.8.0...1.9.0
[1.8.0]: https://github.com/julianhille/MuhammaraJS/compare/1.7.0...1.8.0
[1.7.0]: https://github.com/julianhille/MuhammaraJS/compare/1.6.0...1.7.0
[1.6.0]: https://github.com/julianhille/MuhammaraJS/compare/1.5.1...1.6.0
[1.5.1]: https://github.com/julianhille/MuhammaraJS/compare/1.5.0...1.5.1
[1.5.0]: https://github.com/julianhille/MuhammaraJS/compare/1.4.3...1.5.0
[1.4.3]: https://github.com/julianhille/MuhammaraJS/compare/1.4.2...1.4.3
[1.4.3]: https://github.com/julianhille/MuhammaraJS/compare/1.4.2...1.4.3
[1.4.3]: https://github.com/julianhille/MuhammaraJS/compare/1.4.2...1.4.3
[1.4.2]: https://github.com/julianhille/MuhammaraJS/compare/1.4.1...1.4.2
[1.4.1]: https://github.com/julianhille/MuhammaraJS/compare/1.4.0...1.4.1
[1.4.0]: https://github.com/julianhille/MuhammaraJS/compare/1.3.0...1.4.0
[1.3.0]: https://github.com/julianhille/MuhammaraJS/compare/1.2.0...1.3.0
[1.2.0]: https://github.com/julianhille/MuhammaraJS/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/julianhille/MuhammaraJS/compare/1.0.1...1.1.0
[1.0.1]: https://github.com/julianhille/MuhammaraJS/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/julianhille/MuhammaraJS/tree/1.0.0
