# Changelog

All notable changes to `@muhammara/wasm` are documented in this file.

## [Unreleased]

### Added

- Add a guide for annotating known text regions in existing PDFs with Underline
  or StrikeOut annotations [#290](https://github.com/julianhille/MuhammaraJS/issues/290)
- Add `Recipe#removeText(pageNumber, { forms })` to remove all shown text from
  an existing page, for example before adding a new OCR text layer, and a
  guide for replacing a PDF's text layer [#388](https://github.com/julianhille/MuhammaraJS/issues/388)
- Export the frozen `LineCapStyle` and `ETokenSeparator` objects that native
  exports, with the same member names, for `J()` and `endArray()` [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Export frozen value sets for finite string options, each with a same-named
  type: `DeviceColorSpace`, `DrawingPathType`, `ImageFit`, `PageBox`,
  `PDFImageType`, `EEncoding`, and `ObjectReplacementScope` [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Add native's Recipe value constants as static properties with the native names
  and members, for example `Recipe.TextWrap.ELLIPSIS` and
  `Recipe.AnnotFlag.LOCKED_CONTENTS`: `TextWrap`, `TextAlign`, `TableRowNth`,
  `LineCap`, `LineJoin`, `ArrowAt`, `ArrowType`, `TriangleTrait`,
  `TrianglePosition`, `PageLayout`, `PageSize`, `HorizontalAlign`,
  `VerticalAlign`, `FontStyle`, `Permission`, `Coordinate`, `Colorspace`,
  `AnnotSubtype`, `AnnotFlag`, `ChromaCommand`, and `AnnotIcon`, plus the
  Wasm-only `StructureFormat`. The annotation `flag` option now accepts
  `lockedcontents` [#794](https://github.com/julianhille/MuhammaraJS/issues/794)

### Breaking Changes

- Keep Recipe `circle()`, `ellipse()`, `rectangle()`, `arc()`, and `pie()`
  strokes inside positive requested bounds large enough to contain the line
  width, matching native. Wasm previously centered strokes on the requested
  boundary, extending them outward by half the line width. Adjust layouts that
  relied on that overshoot; see
  [Migrate Vector Stroke Bounds](docs/migrate-vector-stroke-bounds.md)
  [#743](https://github.com/julianhille/MuhammaraJS/issues/743)
- Return a `Uint8Array` instead of an array of numbers from
  `PDFRStreamForBuffer#read()`, the `ByteReader` and `ByteReaderWithPosition`
  adapters, and the byte readers returned by `startReadingFromStream()`,
  `startReadingFromStreamForPlainCopying()`, `getParserStream()`, and
  `getSourceDocumentStream()`, matching native. Replace array methods on the result with
  typed-array operations, or wrap it in `Array.from()`
  [#324](https://github.com/julianhille/MuhammaraJS/issues/324)
- Treat a failed `appendPDFPagesFromPDF()` call as terminal for its writer.
  Previously callers could continue after a failed append and produce a
  corrupted document; create a fresh writer and retry with valid source bytes.
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
- Align `mergePDFPagesToPage` callback receivers with native: strict callbacks now receive `globalThis` instead of `undefined`. Use `callback.bind(undefined)` if an undefined receiver is required.

- Treat low-level shape `type: null` as an unknown type, ending the path without
  painting instead of stroking with stale graphics state, matching native.
  Omit `type` or pass `"stroke"` to draw an outline; see
  [drawing helpers](docs/low-level.md#drawing-helpers-and-clipping).
- Correct low-level shape `type: "clip"` to clip without painting instead of
  stroking, and end paths with unknown types without painting. Pass `"stroke"`/`"fill"` to paint,
  or scope intentional clipping with `q()`/`Q()`. See
  [breaking changes](docs/breaking-changes.md).
- Validate drawing options before emitting shape or text operators, preventing
  failed option getters from leaving partial output. Reject overflowing circle
  and underline geometry, sparse paths, and incomplete or extra modified-form
  path arguments before drawing. Supply complete finite coordinate pairs and
  reduce coordinates or sizes that overflow. Return stable option
  values and correct invalid inputs before retrying; see
  [breaking changes](docs/breaking-changes.md).

### Added

- Add a guide for annotating known text regions in existing PDFs with Underline
  or StrikeOut annotations [#290](https://github.com/julianhille/MuhammaraJS/issues/290)
- Add Recipe `text()` options `underline`, `strikeOut`, and `squiggly` as
  structured text-markup annotations alongside `highlight`, with per-annotation
  `text`, `color`, `opacity`, and `replies`, shared `title`, `date`, `subject`,
  `open`, `richText`, `flag`, and `icon`, one annotation per drawn line, on new
  and edited pages
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Add Recipe HTML text alignment coverage mirroring native, asserting that
  `html: true` lines align like the same text without `html` for `center`,
  `right`, and `justify`, including multi-segment lines and lines ended by
  `<br>` [#708](https://github.com/julianhille/MuhammaraJS/issues/708)
- Add regression coverage for the truncated-input parser sweep, non-sequential
  `appendPDFPageFromPDF` indices, the full rotation fixture matrix, repeated
  `insertPage()` ordering, `FreeText` annotations, and the text `wrap` type
  test, closing test-parity gaps against native
  [#725](https://github.com/julianhille/MuhammaraJS/issues/725)

### Fixed

- Round a Recipe text box with `textBox.style.borderRadius: true` by 5, as
  native does, instead of drawing square corners [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Accept a spread array in the `TJ()` type declaration, so
  `context.TJ(...parts)` compiles; an empty call still throws at runtime
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Write known Recipe `annot()` subtypes with their PDF casing, as native does:
  `annot(x, y, "highlight")` wrote an invalid `/highlight` subtype with a green
  instead of a yellow default color [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Throw "PDF writer has ended" from `calculateTextDimensions()` and
  `getFontMetrics()` of a font whose writer or modifier ended, instead of a
  misleading argument error, and keep a modifier's `createPDFTextString()` and
  `createPDFDate()` usable after `end()`, as native does [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Let a modifier's `doXObject()` place the results of its own
  `createImageXObjectFromJPGBytes()`, `createFormXObjectFromJPGBytes()`,
  `createFormXObjectFromPNGBytes()`, and `createFormXObjectFromTIFF()`, which
  previously threw a `TypeError` [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Let `createWriterToModify().getImageDimensions()` read a PDF registered with
  `registerPdf()`, as the writer does [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Fix `createWriterToModify().createFormXObjectsFromPDF()` throwing
  `ReferenceError: pdfs is not defined` for a PDF registered with
  `registerPdf()` [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Reject `setCreationDate()`, `setModDate()`, and the text Info properties
  of a finished `createWriterToModify()` modifier with the "PDF writer has
  ended" error, and keep the previous Info value when a property assignment
  throws [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Fix `drawRectangle()`, `drawSquare()`, `drawCircle()` and `drawPath()`
  emitting the color and line width inside the path object, which PDF forbids;
  they are now set before the path, as native does [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Fix `writeText()` underlines to use the font's underline position and
  thickness and the text advance, stroked in the text color, matching native
  output [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Fix `writeText()` on modifier forms treating a `gray` colorspace as RGB [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Fix `doXObject()` failing with `Unable to place XObject` on pages created by a
  modifier [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Let a new page expose `getResourcesDictionary()` and receive
  `mergePDFPageToPage()` before a content context is started, as native does [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Accept glyph id lists in `calculateTextDimensions()`, as native does [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Accept any structural `BlobLike` in the async byte inputs, as
  `AsyncByteSource` declares, instead of only `Blob` instances [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Declare Recipe `text()` and `image()` coordinates as `RecipeCoordinate`,
  which accepts `"center"` at runtime, and reject a pattern name without color
  components in the `SCN()`/`scn()` types, as the runtime does [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Throw when a content-context operator such as `rg()`, `cm()`, `Tm()` or
  `k()` gets fewer operands than it needs, as native does, instead of writing
  `nan` into the content stream; the writer page also rejects a non-finite
  `k()` or `G()` operand [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Keep the source `/Trapped`, `CreationDate`, `Title`, `Author`, `Subject`,
  and `Keywords` Info entries when a Recipe saves an existing PDF; they were
  silently dropped. `info()` still overrides them.
  [#779](https://github.com/julianhille/MuhammaraJS/issues/779)
- Clamp `PDFRStreamForBuffer` seek methods to the available bytes, matching
  native built-in stream behavior for PDFs smaller than the parser's trailer
  window [#784](https://github.com/julianhille/MuhammaraJS/issues/784)
- Make `Recipe#replaceText()` match `text` literally and insert `replacement`
  verbatim. Regular-expression characters such as `.` and `$&` no longer
  change what is matched or written, and characters above U+00FF now throw a
  `TypeError` instead of being written as corrupted bytes
  [#785](https://github.com/julianhille/MuhammaraJS/issues/785)
- Keep non-ASCII bytes in a page's content stream intact when `replaceText()`
  rewrites it; they were previously re-encoded as UTF-8, corrupting other
  strings and inline image data on the page.
- Stop `PDFWStreamForBuffer` from copying all previously written bytes on every
  write, which made building large outputs quadratic
  [#324](https://github.com/julianhille/MuhammaraJS/issues/324)
- Fix Recipe character-spacing measurements for retained boundary whitespace
  and non-BMP Unicode text, preventing incorrect wrapping and horizontal
  alignment [#543](https://github.com/julianhille/MuhammaraJS/issues/543)
- Fix the low-level drawing `type` declaration to accept the documented
  `null`, which ends the path without painting
  [#760](https://github.com/julianhille/MuhammaraJS/issues/760)
- Correct `mergePDFPagesToPage()` callback types to expose their `globalThis` receiver [#756](https://github.com/julianhille/MuhammaraJS/issues/756)
- Retire modifying writers after malformed or encrypted PDF append failures so
  callers cannot continue with partially mutated writer state
  [#758](https://github.com/julianhille/MuhammaraJS/issues/758)
- Prefer `getentropy()` for Wasm CSPRNG calls when available [#742](https://github.com/julianhille/MuhammaraJS/issues/742)
- Release copying contexts created by `PDFPageMergingHelper` after file- and
  stream-based merges instead of retaining their parser and source resources
  [#759](https://github.com/julianhille/MuhammaraJS/issues/759)
- Upgrade the shared PDF-Writer foundation to v4.9.1, fixing cleanup of failed
  writer dictionaries and related parser, encryption, and stream ownership
  defects.
- Fix Wasm documentation examples that could not run as written: the Edit Or
  Remove An Existing Annotation how-to never defined `annotationId` and its
  removal example reused a writer and copying context an earlier block had
  already ended; a `queryDictionaryObject` call was unguarded against its own
  documented "returns nothing for a page without annotations" caveat; the
  Watermark Every Page how-to unregistered its font before the "Watermark In
  Place" section that still needed it; the Low-Level API guide never showed
  how to obtain `muhammara` and illustrated `replaceObject()` on a plain
  writer that does not have the method; and the Find Text Positions guide
  reused a reader an earlier block had already ended
  [#740](https://github.com/julianhille/MuhammaraJS/issues/740)
- Finish an active Recipe page in `endPDF()` and `appendPage()` instead of
  failing with `Unable to finish PDF` or
  `Muhammara WebAssembly operation failed: _muhammara_wasm_recipe_append_pdf`,
  matching native. New documents and source edits alike no longer need an
  explicit `endPage()` first, and the Recipe is no longer destroyed by the
  failure. A page still open while pages are marked for deletion is still
  reported, before the Recipe is retired
  [#732](https://github.com/julianhille/MuhammaraJS/issues/732)
- Stop advancing Recipe `position` in `text()`, `movedown()`, and `table()`.
  `position` is the path cursor, written only by `moveTo()` and `lineTo()` as
  in native, and text flow now runs on its own cursor, so drawing text no
  longer moves the point a following path continues from. `editPage()` seeds
  that text cursor with the page margins instead of reporting them as the path
  position
  [#734](https://github.com/julianhille/MuhammaraJS/issues/734)
- Require a Recipe text `size`, or its `fontSize` alias, greater than zero and
  throw `RangeError` naming the option and the value otherwise, instead of
  failing inside the measuring call with an error naming the internal
  `_muhammara_wasm_recipe_text_dimensions` symbol or silently falling back to
  the 14pt default for zero and `NaN`. The check runs before `text()` or
  `textDimensions()` measures or draws anything, on new and edited pages;
  `null`, `undefined`, and an omitted option still select the 14pt default
  [#733](https://github.com/julianhille/MuhammaraJS/issues/733)
- Write a zero-width `/Border` for text-markup annotations (`highlight`,
  `underline`, `strikeOut`, `squiggly`) by default, matching native, instead of
  omitting it and letting viewers apply the PDF default 1pt border. Other
  annotation subtypes keep omitting `/Border` when none is requested
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Stop writing an empty `/RC` or `/Contents` entry for a `richText` annotation
  with no text
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Constrain Recipe text-markup annotations to the visible clipping region when
  using `textBox.wrap: "clip"`, so hidden text does not leave highlights or
  other review markup outside the box
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)

- Reject non-finite Recipe link rectangles before queuing them, so they
  cannot produce malformed PDF coordinates or interrupt `endPage()`, and
  accept negative link widths and heights on edited pages as on new pages,
  covering the same area as native
  [#703](https://github.com/julianhille/MuhammaraJS/issues/703)
- Validate all text-markup options before drawing text or queuing annotations,
  so a rejected `text()` call cannot leave partial content or markup behind
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Write non-string annotation contents and metadata, including replies and
  text-markup `text`, as strings the way native does. Preserve `0` and `false`
  titles and subjects; omit nullish metadata and falsy contents instead of
  failing while finalizing the page
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Reject unsupported URL strings before queuing Recipe links, so non-ASCII
  URLs fail at `link()` instead of interrupting `endPage()`
  [#703](https://github.com/julianhille/MuhammaraJS/issues/703)
- Inherit parent annotation metadata for replies, matching native defaults for
  title, subject, date, flags, open state, and icon while keeping reply opacity
  and rich-text mode independent. An empty or zero reply `flag` keeps the
  parent's flag, as on native
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Write Recipe annotation dash patterns as a nested `/Border` array on new
  documents, matching edited pages and allowing PDF viewers to render the dashes
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Reject invalid annotation options when `annot()`, `comment()`, or a text
  markup option adds the annotation, instead of during `endPage()`. A failed
  call no longer leaves the page unable to end or the Recipe unable to finish
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Stop corrupting the page content stream when a Recipe page has both drawn
  content and an annotation or link, such as `comment()`, `annot()`, `link()`,
  a text `link`, or a text `highlight`; annotations and links are now written
  after the content stream is closed
  [#703](https://github.com/julianhille/MuhammaraJS/issues/703)
- Inherit parent annotation metadata for replies without their own `title`,
  `subject`, `date`, `flag`, `open`, or icon, matching native. A reply keeps
  its own contents, rich-text mode, and opacity (opaque by default)
  [#717](https://github.com/julianhille/MuhammaraJS/issues/717)
- Draw `underline` and `strikeOut` text decoration on edited pages, not only on
  new pages [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Preserve annotation metadata, rich text, dates, and reply relationships on
  edited pages and pages added to existing documents; flush queued annotations
  and links even when an edited page was paused
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Retain drawn content across Recipe `pauseContext()`/`resumeContext()` and
  low-level page-modifier `endContext()`/`startContext()` calls
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Write Recipe annotation `title`, `subject`, and text as PDF text strings, so
  non-ASCII characters no longer display as garbled UTF-8 bytes in PDF viewers
  [#716](https://github.com/julianhille/MuhammaraJS/issues/716)
- Preserve `Date` objects in text-markup options and cover the full width of
  justified HTML lines [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Reject Recipe links between pages instead of attaching them to the next page
  [#703](https://github.com/julianhille/MuhammaraJS/issues/703)
- Bind table overflow callbacks to their Recipe instance, matching their declared
  `this` type and native behavior
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Resolve Recipe text colors like native: gray (`#gg`), CMYK (`#ccmmyykk`),
  percent (`%r,g,b`), and names registered with `chroma()` now draw instead of
  throwing, an unknown name falls back to the default, and text written while
  editing an existing page uses its color
  [#712](https://github.com/julianhille/MuhammaraJS/issues/712)
- Constrain Recipe text links to their visible clipping region when using
  `textBox.wrap: "clip"`, so hidden overflow does not remain clickable outside
  the text box [#718](https://github.com/julianhille/MuhammaraJS/issues/718)
- Preserve explicit table header styles against body-column overrides and
  merge nested `hcell` styles without discarding header backgrounds or borders
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Run a Recipe table column `renderer` once per cell instead of twice, keep the
  text cursor at the table's left edge after an overflow moved the table, keep
  every `border` option such as `dash` on the outer rectangle, and stop drawing
  the table's bottom border twice, including when `overflow` returns `true`
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Leave tables with no columns unchanged instead of setting the cursor to
  `-Infinity`, and throw a clear `Error` when an `overflow` callback ends the
  page without starting another
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Treat inherited record properties as missing table cells instead of
  rendering prototype methods such as `constructor` and `toString`
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Stop a table's `overflow` callback from also running as the text-flow
  overflow callback while drawing a cell's text
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Resolve table cell text boxes like native: a column's `cell` is its only
  body text box, a row `cell` replaces the row's `textBox`, and nested styles
  such as a column fill and a row stroke merge instead of replacing each other.
  A table-level `cell` is ignored. `RecipeTableColumn` no longer declares
  `textBox` and `RecipeTableOptions` no longer declares `cell`; use a column's
  `cell` or `row.cell`
  [#710](https://github.com/julianhille/MuhammaraJS/issues/710)

### Changed

- Release copying contexts that are still open when `end()` is called on a
  writer or modifier, as native does, instead of throwing. `end()` now reports
  `PDF writer has ended` when called twice and names an open objects-context
  operation instead of reporting an active page [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Throw from `PDFReader#getXrefEntry()` for an object ID outside the xref
  table, with the native message, instead of returning `null` [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Let flat `drawPath(x1, y1, x2, y2, ...)` coordinates omit the options object,
  as native allows [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Check `J()`, `j()` and `Tr()` operands on every content context: a line cap
  or line join must be 0 to 2 and a text rendering mode 0 to 7, otherwise a
  `RangeError` is thrown. `j(3)`, previously accepted, now throws [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Throw a `RangeError` from `Tf()` for a non-positive font size and a
  `TypeError` for a foreign font on every content context; form and modifier
  contexts previously threw a `TypeError` for the size and the modifier form
  context a generic `Error` for the font. Form XObject `Tf()` and `Tj()` now
  report an ended form instead of a native failure [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Report an ended modifier form XObject from every content-context method
  instead of a generic native failure, and throw a `TypeError` when `Td()`,
  `TD()`, `Tw()`, `TL()`, or `Ts()` is missing an operand on a modifier form,
  as the other content contexts do [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Validate page range options on `createWriterToModify()` modifiers as the
  writer does: `appendPDFPagesFromPDF()`, `mergePDFPagesToPage()`, and
  `createFormXObjectsFromPDF()` throw a `RangeError` for a `type` that is not
  an `eRangeType*` constant, an empty specific range, or an invalid range,
  where they previously used every page or threw a `TypeError` [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Throw from `createBlankPdf()` for a non-finite or non-positive size, which
  previously produced a zero-width page, and from the low-level
  `registerFont()`, `registerImage()`, and `registerPdf()` for an empty or
  non-string name, as Recipe registration does [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Type the Recipe annotation `flag` option as `Recipe.AnnotFlag | number` and
  `icon` as `Recipe.AnnotIcon` instead of any string, matching native's
  `AnnotFlag` and `AnnotIcon` values [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Rename the text encoding type to `EEncoding`, as native names it; `TextEncoding`
  remains as a deprecated alias [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Define `Glyph` as a list of `[glyphId, unicodeCodePoint]` pairs, as native
  does; `Tj()`, `Quote()`, `DoubleQuote()`, and `TJ()` take `Glyph` where they took
  `Glyph[]`. Code that annotated one pair as `Glyph` should use `[number, number]` [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Type the Recipe `annot()` subtype as `Recipe.AnnotSubtype`, the native
  `AnnotSubtype` values, and add `lockedcontents` to `Recipe.AnnotFlag` [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Add a `Recipe` type namespace with native's names: one type per Recipe value
  set, for example `Recipe.TextWrap` and `Recipe.AnnotFlag`, and the option
  types, for example `Recipe.TextOptions` and `Recipe.TableOptions`; type
  `createPage(size)` as `Recipe.PageSize` and text-box `textAlign` as
  `Recipe.TextBoxAlign` instead of any string [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Add native's low-level type names as aliases, for example `EPDFVersion`,
  `UsedFont`, `TextDimension`, `JPEGInformation`, `TransformationObject`, and
  `PageContentContext`, so declarations shared with `@muhammara/native` compile
  against both packages [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Throw a `TypeError` from `drawRectangle()`, `drawSquare()`, `drawCircle()`, and
  `drawPath()` for a `type` that is not a `DrawingPathType` value or `null`,
  instead of ending the path unpainted; native keeps the old behavior [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Type returned PDF bytes as `Uint8Array<ArrayBuffer>`, so `new Blob([bytes])`
  and `new Response(bytes)` compile without a cast. The declarations now require
  TypeScript 5.7 or later; older compilers report `Type 'Uint8Array' is not
generic` [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Type finite option values by name: `J()`, `j()`, and `Tr()` take
  `LineCapStyle`, `LineJoinStyle`, and `TextRenderingMode`; `trapped`,
  `endArray()`, `getType()`, `getTypeLabel()`, `getTrailerEntryType()`,
  `getXrefEntry().type`, `addProcsetResource()`, and the page-box arguments of
  `createFormXObjectFromPDFPage()` and `createFormXObjectsFromPDF()` use
  `EInfoTrapped`, `ETokenSeparator`, `PDFObjectType`, `XrefEntryType`,
  `ProcsetName`, and `PDFPageBoxType`, and the matching constants carry their
  literal values. Recipe image `align`, previously any string, takes the
  alignment keywords. Code passing an out-of-set literal now fails `tsc` [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Reject inherited object keys such as `toString` as `getPageBox()` box names [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Rework the npm README: it explains how the MuhammaraJS packages fit together, when to use a native package instead, and adds tested quick-start examples [#772](https://github.com/julianhille/MuhammaraJS/issues/772)
- Narrow `DrawPathOptions.type` from an arbitrary string to the exported
  `DrawingPathType` (`"stroke" | "fill" | "clip" | null`), matching native.
  Unsupported paint modes neither paint nor clip, so they are now a compile
  error rather than silently unpainted geometry; pass a supported type
  [#760](https://github.com/julianhille/MuhammaraJS/issues/760)
- Resolve table header styles independently of body styles, matching native.
  Headers that inherited a body font, size, or color can change appearance;
  set those properties explicitly in `header` to retain the intended style
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Derive Recipe `table()` columns from every record and apply native's default
  2pt cell/header padding. Tables can gain columns or grow taller; use explicit
  `order`/`columns` and set `cell.padding` and `header.cell.padding` to `0` to
  retain unpadded layouts. Fixed cell/header heights now count toward table
  sizing and pagination
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Throw `RangeError` when an `overflow` destination cannot fit a row and its
  repeated header instead of drawing beyond the bounds. Return `true` to stop
  or provide a large enough continuation area. Callbacks now receive the Recipe
  as `this`, matching native
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Render leading `<br>` elements in Recipe HTML text as blank lines, as native
  Recipe does, instead of ignoring them
  [#667](https://github.com/julianhille/MuhammaraJS/issues/667)
- Align the Recipe declarations with native: generic `RecipeExtension`
  callbacks and `register()` overloads, `table<RecordType>()` with typed
  columns, `order`, and per-column `renderer` values, numeric `layout()`
  `columns`, finite arrow `type`, `head`, and `shaft` values, and native
  triangle trait, position, and vertex overloads
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Type drawing, text, and `chroma()` color spaces as the new
  `RecipeDeviceColorSpace`, so Separation colors, which WebAssembly Recipe
  rejects at runtime, now fail type checking
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Reject Recipe annotations with an `opacity` outside 0 to 1, a non-finite
  `width`, `height`, or `borderWidth`, non-numeric `borderDash` values, or
  `quadPoints` whose length is not a multiple of eight with
  `TypeError: Invalid annotation options` from `annot()`, `comment()`, or
  `text()`, on new and edited pages alike; new pages previously threw a generic
  `Unable to create annotation` error from `endPage()` for an invalid `opacity`
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Draw Recipe text without a `color` in native's default `#1777d1` instead of
  black. Pass `color: "#000000"` to keep black text
  [#712](https://github.com/julianhille/MuhammaraJS/issues/712)
- Derive Recipe `table()` columns from every record instead of only the first,
  keep `order` entries whose field the first record lacks, and give cells and
  headers native's default 2pt padding, matching native Recipe table layout
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Create `Underline` and `StrikeOut` annotations for the `underline` and
  `strikeOut` text options instead of drawing black lines, and place
  `Highlight` annotations over native's line box. HTML `<u>` and `<del>` still
  draw lines, now in the text color at native's offsets; use `line()` to keep
  a drawn rule under plain text
  [#714](https://github.com/julianhille/MuhammaraJS/issues/714)

## [1.0.0-beta.3] - 2026-09-18

### Added

- Declare and document the `wasmBinary` loading option, which instantiates the
  module from caller-supplied `Uint8Array` or `ArrayBuffer` bytes without
  fetching the binary, and reject other inputs with a `TypeError`
  [#702](https://github.com/julianhille/MuhammaraJS/issues/702)

### Fixed

- Deploy the browser example on a release tag when the `gh-pages` branch does
  not exist yet. The already-deployed check treated a missing branch as a
  completed deployment, skipping the `mike deploy` that creates the branch and
  then failing the release job when it checked that branch out
  [#690](https://github.com/julianhille/MuhammaraJS/issues/690)
- Create the GitHub release before publishing to npm, and skip the publish when
  the registry already serves the tagged version, so a re-run on an existing tag
  completes instead of failing
  [#696](https://github.com/julianhille/MuhammaraJS/issues/696)
- Mark alpha, beta, and release candidate GitHub releases as pre-releases
  [#696](https://github.com/julianhille/MuhammaraJS/issues/696)

## [1.0.0-beta.2] - 2026-09-14

### Added

- Publish versioned executable browser examples to GitHub Pages for `develop`
  and release builds
  [#690](https://github.com/julianhille/MuhammaraJS/issues/690)
- Support chainable Recipe `pauseContext()` and `resumeContext()` transitions
  on newly created pages while retaining errors for unmatched calls
  [#608](https://github.com/julianhille/MuhammaraJS/issues/608)
- Add native-style visual rendering for unordered, ordered, nested, formatted,
  and linked HTML lists in Wasm Recipe
  [#661](https://github.com/julianhille/MuhammaraJS/issues/661)
- Add Recipe URL links for arbitrary areas, rendered text, images, and drawing
  bounds [#614](https://github.com/julianhille/MuhammaraJS/issues/614)
- Add generated behavioral API reference documentation from JSDoc on every
  public Recipe method, with named TypeScript option and result types
  [#652](https://github.com/julianhille/MuhammaraJS/issues/652)
- Add a MkDocs-validated guide index for browser examples
  [#627](https://github.com/julianhille/MuhammaraJS/issues/627)
- Bundle Apache-2.0 Roboto Regular as Recipe's automatic default font, so text,
  text measurement, and tables work without font registration in browsers and
  Workers. Load it through a separate dynamic import; custom `defaultFont` bytes
  or `defaultFont: false` skip the font download, as does the low-level API.
  Make font uploads optional in the browser table example
  [#613](https://github.com/julianhille/MuhammaraJS/issues/613)
- Add Recipe `replaceText()` for replacing literal text in a page content stream
  [#622](https://github.com/julianhille/MuhammaraJS/issues/622)
- Document that Recipe `getPageInfo()` returns document Info metadata, while
  `pageInfo()` and `getCurrentPageInfo()` return page geometry
  [#621](https://github.com/julianhille/MuhammaraJS/issues/621)
- Document Recipe `opacity()` as applying fill and stroke alpha
  [#618](https://github.com/julianhille/MuhammaraJS/issues/618)
- Document Recipe `lineStyle()` option compatibility with native
  [#617](https://github.com/julianhille/MuhammaraJS/issues/617)
- Add third-party notices and security, provenance, and contribution guidance
  for the WebAssembly package [#626](https://github.com/julianhille/MuhammaraJS/issues/626)
- Add chainable Recipe `deletePage()` support for removing one or more pages
  from an existing byte-backed PDF while preserving retained page objects
  [#548](https://github.com/julianhille/MuhammaraJS/issues/548)
- Add byte-first `recrypt()` and Recipe `encrypt()` with native-compatible
  password options, plus the password-change browser example
  [#595](https://github.com/julianhille/MuhammaraJS/issues/595)
- Document watermarking in place with the byte-first Recipe, and how it
  differs from the native package's path-based overwrite
  [#297](https://github.com/julianhille/MuhammaraJS/issues/297)
- Document adding standard and custom Info dictionary metadata, including
  dotted OID keys, to an existing PDF, and the lower-cased read-back, dropped
  custom entries, and stamped provenance that come with it
  [#450](https://github.com/julianhille/MuhammaraJS/issues/450)
- Document editing and removing an annotation that already exists in a PDF,
  including ending the copying context before the writer
  [#385](https://github.com/julianhille/MuhammaraJS/issues/385)
- Add `PDFReader.extractPageContentItems(pageIndex, limits?)` for detecting
  page-marking content operations, matching the Node reader, along with the
  `ePDFPageContentItemText`, `ePDFPageContentItemPath`,
  `ePDFPageContentItemXObject`, and `ePDFPageContentItemShading` constants
  [#275](https://github.com/julianhille/MuhammaraJS/issues/275)
- Document the extraction budget and page-mark detection in the text-position
  guide [#275](https://github.com/julianhille/MuhammaraJS/issues/275)
- Show `extractPageContentItems()` in the low-level browser example
  [#275](https://github.com/julianhille/MuhammaraJS/issues/275)
- Add idempotent `PDFByteReader.dispose()` for immediately releasing Wasm
  decoded, plain-copying, parser, and copying-context stream readers.

### Changed

- Make documentation self-contained by replacing links to tests, implementation
  files, and GitHub releases with local guides and inline explanations
  [#689](https://github.com/julianhille/MuhammaraJS/issues/689)
- Validate that the native GYP and Wasm CMake builds compile the same PDFWriter
  translation units and that the Wasm ABI exports exactly match runtime use
  [#684](https://github.com/julianhille/MuhammaraJS/issues/684)
- Validate that the Wasm npm package contains its JavaScript, WebAssembly,
  declarations, and fonts without development sources or build files
  [#684](https://github.com/julianhille/MuhammaraJS/issues/684)
- Run a Wasm npm publish dry run, then publish the npm package before creating
  the GitHub release so publication failures do not leave orphan releases
  [#684](https://github.com/julianhille/MuhammaraJS/issues/684)
- Replace the monolithic Wasm Recipe guide with focused, byte-first topic pages
  parallel to the native documentation [#649](https://github.com/julianhille/MuhammaraJS/issues/649)
- Document the native-only writer events and Wasm-only `dispose()` methods
  [#624](https://github.com/julianhille/MuhammaraJS/issues/624)
- Document the browser example's grayscale form XObject tab
  [#630](https://github.com/julianhille/MuhammaraJS/issues/630)
- Reject invalid page indices and object IDs in the reader's `getPageObjectID()`
  and `getXrefEntry()`, and reject values of 2^32 and above in every reader
  method that takes an index, so both ends fail the same way [#581](https://github.com/julianhille/MuhammaraJS/issues/581)
- Cache Emscripten compiler output between builds and give each build
  configuration its own build directory, so repeat builds reuse compiled
  objects while sanitizer and normal builds stay separate
  [#568](https://github.com/julianhille/MuhammaraJS/issues/568)
- Clamp `extractPageText()` limits to the built-in ceilings. Callers can still
  tighten the extraction budget, but can no longer raise it above the bound the
  extractor enforces.
- Rename `PDFTextExtractionLimits` to `PDFExtractionLimits`, now shared by both
  extractors. The old name remains as a deprecated alias.
- Reword the limits shape error to `Extraction limits must be an object` so both
  readers report it identically.
- Set the `Creator` Info entry that `Recipe` writes to
  `Muhammara-Recipe (https://github.com/julianhille/MuhammaraJS)`, replacing the
  inherited `Hummus-Recipe` value. PDFs edited with `Recipe` still record the
  source document's own creator as `source-Creator`.

### Removed

- Remove browser example source files from the `@muhammara/wasm` npm package,
  keeping the published package runtime-only; examples remain available on the
  [documentation site](https://muhammarajs-wasm.readthedocs.io/latest/browser-examples/)
  and in the repository [#684](https://github.com/julianhille/MuhammaraJS/issues/684)

### Fixed

- Guard stateful writer methods consistently after `end()`, `dispose()`, or
  failed finalization with `Error("PDF writer has ended")`, matching native;
  asynchronous methods preserve promise rejection semantics
  [#693](https://github.com/julianhille/MuhammaraJS/issues/693)
- Preserve embedded NUL bytes in the Wasm low-level `TJ()`, `Tj()`, `Quote()`,
  and `DoubleQuote()` strings instead of silently truncating each string at the
  first NUL [#683](https://github.com/julianhille/MuhammaraJS/issues/683)
- Reject unsupported PDF 2.0/AES-256 encryption in `recrypt()` with a clear
  WebAssembly limitation error
  [#678](https://github.com/julianhille/MuhammaraJS/issues/678)
- Prevent Wasm text extraction from reporting inline-image payload bytes as
  fabricated page text [#670](https://github.com/julianhille/MuhammaraJS/issues/670)
- Report the correct text-to-page matrix after text-positioning and `cm`
  operations while extracting page text
  [#673](https://github.com/julianhille/MuhammaraJS/issues/673)
- Preserve HTML whitespace, non-breaking spaces, inline layout, and transforms;
  render one marker per list item while matching native wrapping and nesting;
  recover malformed list closures in linear time without retaining void
  elements; measure HTML table cells; apply character spacing across formatted
  runs, scoped to its own text operation so later low-level page text does not
  inherit it and rejecting non-finite `charSpace` values; transform highlights
  and links with their text and source page; and constrain linked text to
  clipped text boxes
  [#661](https://github.com/julianhille/MuhammaraJS/issues/661)
- Align Recipe text, measurement, and layout defaults on 14 points to match
  native, correcting the 12-point default in the alpha and beta releases
  [#605](https://github.com/julianhille/MuhammaraJS/issues/605)
- Retire the byte-first Recipe and rethrow the original error on later
  `endPDF()` calls after a finalization failure, matching native, instead of
  re-entering finalization against an already-destroyed handle
  [#693](https://github.com/julianhille/MuhammaraJS/issues/693)

## [1.0.0-beta.1] - 2026-09-05

### Fixed

- Generate the API reference during Read the Docs builds [#566](https://github.com/julianhille/MuhammaraJS/issues/566)

### Changed

- Skip Wasm package CI for documentation-only changes; Documentation CI
  validates those updates.

## [1.0.0-alpha.1] - 2026-09-04

### Added

- Add browser-safe, byte-first PDF creation, reading, modification, and Recipe
  APIs for browser pages and Workers.
- Add Chrome page and Worker validation, TypeScript declarations, ABI export
  checks, and lifecycle regression coverage.

### Fixed

- Validate Wasm ABI exports, resource ownership, temporary-file cleanup, and
  bounded byte input/output handling.

[Unreleased]: https://github.com/julianhille/MuhammaraJS/compare/wasm-v1.0.0-beta.3...HEAD
[1.0.0-beta.3]: https://github.com/julianhille/MuhammaraJS/compare/wasm-v1.0.0-beta.2...wasm-v1.0.0-beta.3
[1.0.0-beta.2]: https://github.com/julianhille/MuhammaraJS/compare/wasm-v1.0.0-beta.1...wasm-v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/julianhille/MuhammaraJS/compare/wasm-v1.0.0-alpha.1...wasm-v1.0.0-beta.1
[1.0.0-alpha.1]: https://github.com/julianhille/MuhammaraJS/releases/tag/wasm-v1.0.0-alpha.1
