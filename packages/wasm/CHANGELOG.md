# Changelog

All notable changes to `@muhammara/wasm` are documented in this file.

## [Unreleased]

### Added

- Embed every third-party license and copyright notice in
  `muhammara-wasm.wasm` as its first section, a custom section named
  `license` holding plain UTF-8 Markdown, so the notices travel with the
  binary when a bundler copies it without the package's other files. The text
  is a table of every component (PDFWriter, FreeType with its BDF and PCF
  drivers, zlib, LibAesgm, libjpeg, libpng, libtiff, the Emscripten runtime,
  musl, libc++, libc++abi, compiler-rt, dlmalloc, and the JavaScript-shipped
  Roboto Regular and Adobe Glyph List), then each component's license in full.
  It grows the `.wasm` by 129,371 bytes raw (2,106,511 to 2,235,882) and by
  28,018 bytes gzipped at level 9 (779,984 to 808,002) [#876](https://github.com/julianhille/MuhammaraJS/issues/876)
- Add `Recipe.thirdPartyLicenses()`, which returns those notices from the
  module that `createRecipe()` loaded, without fetching, compiling, or
  instantiating anything. It throws when the WebAssembly module is not loaded
  and when the binary has no `license` section, for example after
  `wasm-strip` [#876](https://github.com/julianhille/MuhammaraJS/issues/876)
- Ship the same text as `dist/THIRD_PARTY_LICENSES.md`, exported as
  `@muhammara/wasm/THIRD_PARTY_LICENSES.md`. It replaces
  `THIRD_PARTY_NOTICES.md`, which summarized some licenses and linked to
  others instead of reproducing them. The build assembles it from the
  verbatim license files in each vendored library's `licenses/` folder and the
  Emscripten toolchain that linked the binary [#876](https://github.com/julianhille/MuhammaraJS/issues/876)

## [1.0.0] - 2026-10-01

### Added

- Add browser-safe, byte-first PDF creation, reading, modification, and Recipe
  APIs for browser pages and Workers, built on the PDF-Writer foundation
  shared with native (v4.9.1) and checked in Chrome pages and Workers and by a
  test suite that mirrors native's [#725](https://github.com/julianhille/MuhammaraJS/issues/725). The shared
  PDF-Writer carries local fixes: dictionaries left open when a writer ends or
  is disposed are released [#815](https://github.com/julianhille/MuhammaraJS/issues/815), pages of malformed PDFs, such as one whose
  `/Annots` is not an array or whose `/Resources` is not a dictionary, can be
  edited with the malformed entry dropped or replaced [#816](https://github.com/julianhille/MuhammaraJS/issues/816), and a failed
  image or font load frees its object IDs and leaves the writer usable [#825](https://github.com/julianhille/MuhammaraJS/issues/825)
- Bundle zlib 1.3.1, libpng 1.6.59, libtiff 4.7.2, FreeType 2.14.3, and IJG
  libjpeg 10, the vendored copies shared with native, with their upstream
  security fixes, among them CVE-2018-25032 and CVE-2022-37434 (zlib),
  CVE-2026-33416, CVE-2026-34757, and CVE-2026-46675 (libpng), CVE-2023-52356
  and CVE-2024-7006 (libtiff), and CVE-2025-27363 (FreeType); libjpeg decodes
  `DCTDecode` streams read from PDFs [#862](https://github.com/julianhille/MuhammaraJS/issues/862) [#863](https://github.com/julianhille/MuhammaraJS/issues/863) [#864](https://github.com/julianhille/MuhammaraJS/issues/864) [#865](https://github.com/julianhille/MuhammaraJS/issues/865) [#866](https://github.com/julianhille/MuhammaraJS/issues/866)
- Add the `wasmBinary` loading option, which instantiates the module from
  caller-supplied `Uint8Array` or `ArrayBuffer` bytes without fetching the
  binary and rejects other inputs with a `TypeError`; see
  [Load the Wasm Binary](docs/how-to/load-the-wasm-binary.md) [#702](https://github.com/julianhille/MuhammaraJS/issues/702)
- Bundle Apache-2.0 Roboto Regular as Recipe's automatic default font, so
  text, text measurement, and tables work without font registration in
  browsers and Workers. It loads through a separate dynamic import; custom
  `defaultFont` bytes, `defaultFont: false`, and the low-level API skip the
  download [#613](https://github.com/julianhille/MuhammaraJS/issues/613)
- Encrypt PDFs written by `createWriter()` with native's `userPassword`,
  `ownerPassword`, and `userProtectionFlag` options, open encrypted PDFs with
  the `password` option of `createReader()` and `createReaderAsync()`, and
  change or remove passwords with byte-first `recrypt()` and Recipe
  `encrypt()`, using `getentropy()` for random bytes when available. `log`,
  PDF 2.0/AES-256 encryption, encryption options on `createWriterToModify()`,
  and a source `password` in `createPDFCopyingContext()` and
  `createPDFCopyingContextAsync()` throw a clear error; decrypt such a source
  with `recrypt()` first. `createReader()` takes native's options object as
  its second argument and throws a `TypeError` for anything else; see
  [Change PDF Passwords](docs/how-to/change-pdf-passwords.md) [#595](https://github.com/julianhille/MuhammaraJS/issues/595) [#678](https://github.com/julianhille/MuhammaraJS/issues/678)
  [#742](https://github.com/julianhille/MuhammaraJS/issues/742) [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Add the low-level drawing helpers `drawRectangle()`, `drawSquare()`,
  `drawCircle()`, and `drawPath()` and `writeText()` with native's behavior:
  color and line width are set before the path, `type` is a
  `DrawingPathType` (`"stroke"`, `"fill"`, `"clip"`, or `null`, which ends the
  path without painting), and any other `type` throws
  `Unknown drawing type; use "stroke", "fill", "clip" or null`. All options are
  validated before anything is drawn, so a rejected call leaves no partial
  output; flat `drawPath(x1, y1, x2, y2, ...)` coordinates may omit the
  options object; and `writeText()` underlines use the font's underline
  position and thickness, stroked in the text color, on writer and modifier
  forms alike; see
  [drawing helpers](docs/low-level.md#drawing-helpers-and-clipping) [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
  [#760](https://github.com/julianhille/MuhammaraJS/issues/760) [#794](https://github.com/julianhille/MuhammaraJS/issues/794) [#853](https://github.com/julianhille/MuhammaraJS/issues/853)
- Accept native's colors in the low-level drawing helpers, `writeText()`,
  `CompactModifier`, and Recipe annotations: every CSS color name in any case
  and `#rrggbb` strings, while a hex string without `#` or an empty string
  throws a `TypeError`. A color name, `#rrggbb` string, or `[r, g, b]` array
  with `colorspace: "gray"` or `"cmyk"` throws
  `TypeError: only a numeric color can use the gray or cmyk colorspace`; see
  [Draw in Gray and CMYK](docs/how-to/draw-in-gray-and-cmyk.md) [#796](https://github.com/julianhille/MuhammaraJS/issues/796) [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
- Check content-context operators like native on every content context: an
  operator given fewer operands than it needs, such as `rg()`, `cm()`, `Tm()`,
  or `k()`, throws instead of writing `nan`; `J()` and `j()` take 0 to 2 and
  `Tr()` 0 to 7, otherwise throwing a `RangeError`; `Tf()` throws a
  `RangeError` for a non-positive size and a `TypeError` for a foreign font;
  and an ended modifier form XObject is reported by every method. `SCN` and
  `scn` accept a pattern name alone to select a colored tiling pattern,
  `TJ()`, `Tj()`, `Quote()`, and `DoubleQuote()` keep embedded NUL bytes, and
  `writeLiteralString()`, `writeHexString()`, `writeLiteralStringValue()`,
  `writeHexStringValue()`, and `PDFWStreamForBuffer.write()` accept arrays of
  byte values from 0 to 255 [#683](https://github.com/julianhille/MuhammaraJS/issues/683) [#794](https://github.com/julianhille/MuhammaraJS/issues/794) [#797](https://github.com/julianhille/MuhammaraJS/issues/797)
- Guard stateful writer and modifier methods after `end()`, `dispose()`, or a
  failed finalization with `Error("PDF writer has ended")`, as native does,
  including `calculateTextDimensions()` and `getFontMetrics()` of a font whose
  writer ended and `setCreationDate()`, `setModDate()`, and the text Info
  properties of a finished modifier; asynchronous methods reject instead of
  throwing. `end()` releases copying contexts that are still open and names an
  open objects-context operation, and a modifier's `createPDFTextString()` and
  `createPDFDate()` stay usable after `end()` [#693](https://github.com/julianhille/MuhammaraJS/issues/693) [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Release a form started with `createFormXObject()` and never ended, and the
  content stream of an open page, when a writer, writer-to-modify, or Recipe
  is disposed, so building many documents in one module does not exhaust its
  memory [#814](https://github.com/julianhille/MuhammaraJS/issues/814) [#822](https://github.com/julianhille/MuhammaraJS/issues/822)
- Add native's modifier behavior to `createWriterToModify()`: `doXObject()`
  places the modifier's own image and form XObjects on existing and new pages,
  `getImageDimensions()` and `createFormXObjectsFromPDF()` read PDFs
  registered with `registerPdf()`, a new page exposes
  `getResourcesDictionary()` and accepts `mergePDFPageToPage()` before its
  content context starts, and `addImageXObjectMapping()` accepts an image
  XObject as well as an object ID [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Validate page ranges and inputs like native: `appendPDFPagesFromPDF()`,
  `mergePDFPagesToPage()`, and `createFormXObjectsFromPDF()` throw a
  `RangeError` for an invalid range type or range on writers and modifiers
  alike; `appendPDFPagesFromPDF()` rejects unparsable or encrypted source
  bytes and out-of-range pages before writing anything, leaving the writer
  usable, while a failure during copying retires the writer; and
  `createBlankPdf()`, `registerFont()`, `registerImage()`, and `registerPdf()`
  reject invalid sizes and names [#750](https://github.com/julianhille/MuhammaraJS/issues/750) [#758](https://github.com/julianhille/MuhammaraJS/issues/758) [#794](https://github.com/julianhille/MuhammaraJS/issues/794) [#828](https://github.com/julianhille/MuhammaraJS/issues/828)
- Call `mergePDFPagesToPage()` callbacks with `globalThis` as their receiver,
  as native does, and release the copying contexts `PDFPageMergingHelper`
  creates once a merge ends [#750](https://github.com/julianhille/MuhammaraJS/issues/750) [#756](https://github.com/julianhille/MuhammaraJS/issues/756) [#759](https://github.com/julianhille/MuhammaraJS/issues/759)
- Add byte streams that match native: `PDFWStreamForBuffer` appends in linear
  time, `PDFRStreamForBuffer` seeks are clamped to the available bytes, and
  `PDFRStreamForBuffer#read()`, the `ByteReader` and `ByteReaderWithPosition`
  adapters, and the readers from `startReadingFromStream()`,
  `startReadingFromStreamForPlainCopying()`, `getParserStream()`, and
  `getSourceDocumentStream()` return a `Uint8Array`. Idempotent
  `PDFByteReader.dispose()` releases a stream reader at once, and the async
  byte inputs accept any structural `BlobLike` [#324](https://github.com/julianhille/MuhammaraJS/issues/324) [#784](https://github.com/julianhille/MuhammaraJS/issues/784) [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Validate reader indices like native: `getPageObjectID()` and
  `getXrefEntry()` throw for an invalid page index or object ID, every method
  that takes an index rejects values of 2^32 and above, and `getPageBox()`
  rejects inherited object keys such as `toString` as box names [#581](https://github.com/julianhille/MuhammaraJS/issues/581) [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Add `PDFReader#extractPageText()` with a decoded Unicode `text` field,
  decoded through the font's `/ToUnicode` CMap, `/Encoding`, and
  `/Differences`, next to the raw `content` codes; `{ decodeText: false }`
  skips decoding. Text-to-page matrices follow text positioning and `cm`,
  inline-image data is never reported as text, and `fontResource` names are
  UTF-8 text [#670](https://github.com/julianhille/MuhammaraJS/issues/670) [#673](https://github.com/julianhille/MuhammaraJS/issues/673) [#788](https://github.com/julianhille/MuhammaraJS/issues/788)
- Add `PDFReader.extractPageContentItems(pageIndex, limits?)` for detecting
  page-marking content operations, matching the Node reader, with the
  `ePDFPageContentItemText`, `ePDFPageContentItemPath`,
  `ePDFPageContentItemXObject`, and `ePDFPageContentItemShading` constants.
  Both extractors share `PDFExtractionLimits` (`PDFTextExtractionLimits` is a
  deprecated alias), clamp limits to the built-in ceilings, and report a
  malformed limits value as `Extraction limits must be an object` [#275](https://github.com/julianhille/MuhammaraJS/issues/275)
- Measure `UsedFont#calculateTextDimensions()` at the exact, possibly
  fractional, font size, and accept glyph id lists as native does [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
  [#798](https://github.com/julianhille/MuhammaraJS/issues/798)
- Export native's frozen value sets with the same member names, among them
  `LineCapStyle` and `ETokenSeparator`, plus `DeviceColorSpace`,
  `DrawingPathType`, `ImageFit`, `PageBox`, `PDFImageType`, `EEncoding`, and
  `ObjectReplacementScope`, each with a same-named type, and native's Recipe
  value constants as static properties, for example `Recipe.TextWrap.ELLIPSIS`
  and `Recipe.AnnotFlag.LOCKED_CONTENTS`: `TextWrap`, `TextAlign`,
  `TableRowNth`, `LineCap`, `LineJoin`, `ArrowAt`, `ArrowType`,
  `TriangleTrait`, `TrianglePosition`, `PageLayout`, `PageSize`,
  `HorizontalAlign`, `VerticalAlign`, `FontStyle`, `Permission`, `Coordinate`,
  `Colorspace`, `AnnotSubtype`, `AnnotFlag`, `ChromaCommand`, and `AnnotIcon`,
  plus the Wasm-only `StructureFormat` [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Ship TypeScript declarations that follow native's, so code typed for
  `@muhammara/native` compiles against both packages: a `Recipe` type
  namespace with one type per value set and the option types, such as
  `Recipe.TextOptions` and `Recipe.TableOptions`; native's low-level type
  names, such as `EPDFVersion`, `UsedFont`, `TextDimension`, and
  `PageContentContext`; `EEncoding` (`TextEncoding` is a deprecated alias);
  `Glyph` as a list of `[glyphId, unicodeCodePoint]` pairs, with `TJ()`
  accepting spread parts; readonly arrays and `"center"` coordinates
  (`RecipeCoordinate`) in Recipe options; generic `RecipeExtension` callbacks
  and `register()` overloads; `table<RecordType>()` with typed columns; and
  callbacks typed with their real receiver [#665](https://github.com/julianhille/MuhammaraJS/issues/665) [#756](https://github.com/julianhille/MuhammaraJS/issues/756) [#792](https://github.com/julianhille/MuhammaraJS/issues/792) [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Type finite options by name so an out-of-set literal fails `tsc`: `J()`,
  `j()`, and `Tr()` take `LineCapStyle`, `LineJoinStyle`, and
  `TextRenderingMode`; `trapped`, `endArray()`, `getType()`,
  `getTrailerEntryType()`, `getXrefEntry().type`, `addProcsetResource()`, and
  the page-box arguments take `EInfoTrapped`, `ETokenSeparator`,
  `PDFObjectType`, `XrefEntryType`, `ProcsetName`, and `PDFPageBoxType`;
  `DrawPathOptions.type` takes `DrawingPathType`; and Recipe `createPage()`,
  image `align`, text-box `textAlign`, and annotation `annot()` subtype,
  `flag`, and `icon` take `Recipe.PageSize`, the alignment keywords,
  `Recipe.TextBoxAlign`, `Recipe.AnnotSubtype`, `Recipe.AnnotFlag | number`,
  and `Recipe.AnnotIcon` [#760](https://github.com/julianhille/MuhammaraJS/issues/760) [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Type returned PDF bytes as `Uint8Array<ArrayBuffer>`, so `new Blob([bytes])`
  and `new Response(bytes)` compile without a cast; the declarations require
  TypeScript 5.7 or later [#794](https://github.com/julianhille/MuhammaraJS/issues/794)
- Draw Recipe text like native: 14-point text, measurement, and layout
  defaults; native's default color `#1777d1`; gray (`#gg`), CMYK
  (`#ccmmyykk`), percent (`%r,g,b`), and `chroma()` colors, with unknown names
  falling back to the default, on new and edited pages; a `size` (or
  `fontSize`) that is not a finite number greater than zero throws a
  `RangeError` before anything is drawn; `opacity` applies to that text only,
  clamped to 0 to 1; character spacing is measured correctly for boundary
  whitespace and non-BMP text; the `overflow` callback runs with the Recipe as
  `this`; `textBox.style.borderRadius: true` rounds by 5; and `null` options
  act like omitted options [#543](https://github.com/julianhille/MuhammaraJS/issues/543) [#605](https://github.com/julianhille/MuhammaraJS/issues/605) [#712](https://github.com/julianhille/MuhammaraJS/issues/712) [#733](https://github.com/julianhille/MuhammaraJS/issues/733) [#794](https://github.com/julianhille/MuhammaraJS/issues/794) [#798](https://github.com/julianhille/MuhammaraJS/issues/798) [#807](https://github.com/julianhille/MuhammaraJS/issues/807)
  [#829](https://github.com/julianhille/MuhammaraJS/issues/829)
- Keep text flow on its own cursor: Recipe `position` is the path cursor,
  written only by `moveTo()` and `lineTo()` as in native, so `text()`,
  `movedown()`, and `table()` do not move the point a following path continues
  from, and `editPage()` starts the text cursor at the page margins [#734](https://github.com/julianhille/MuhammaraJS/issues/734)
- Render Recipe HTML text like native: unordered, ordered, nested, formatted,
  and linked lists with one marker per item; whitespace, non-breaking spaces,
  inline layout, and transforms; leading `<br>` elements as blank lines;
  measured HTML table cells; character spacing across formatted runs; `<u>`
  and `<del>` drawn in the text color at native's offsets; and `center`,
  `right`, and `justify` lines aligned like plain text; see
  [Render HTML Lists](docs/how-to/render-html-lists.md) [#661](https://github.com/julianhille/MuhammaraJS/issues/661) [#667](https://github.com/julianhille/MuhammaraJS/issues/667) [#708](https://github.com/julianhille/MuhammaraJS/issues/708)
  [#714](https://github.com/julianhille/MuhammaraJS/issues/714)
- Add Recipe `text()` options `highlight`, `underline`, `strikeOut`, and
  `squiggly`, which create Highlight, Underline, StrikeOut, and Squiggly
  annotations over native's line box, one per drawn line, on new and edited
  pages, with per-annotation `text`, `color`, `opacity`, and `replies`, shared
  `title`, `date`, `subject`, `open`, `richText`, `flag`, and `icon`, a
  zero-width `/Border` by default, and clipping to the visible region with
  `textBox.wrap: "clip"`; all options are validated before any text is drawn
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665) [#714](https://github.com/julianhille/MuhammaraJS/issues/714)
- Add Recipe annotations with native's behavior: `annot()` and `comment()`
  place (x, y) at the top-left corner; known subtypes are written with their
  PDF casing; colors resolve as `#rrggbb`, `%r,g,b`, `chroma()` names, then
  CSS names, with `color` arrays read as 0 to 255, and anything else throws
  `TypeError: Unknown annotation color (<value>)`; `title`, `subject`, and
  contents are written as PDF text strings; `border: 0` writes
  `/Border [0 0 0]`, dash patterns a nested `/Border` array, and a `date` of
  `0` the Unix epoch; replies inherit their parent's `title`, `subject`,
  `date`, `flag`, `open`, and icon but keep their own contents, rich-text
  mode, and opacity; `flag` accepts `lockedcontents`; and invalid options
  throw `TypeError: Invalid annotation options` when the annotation is added,
  not in `endPage()`. Annotations, metadata, and replies are kept on edited
  pages and pages added to existing documents [#665](https://github.com/julianhille/MuhammaraJS/issues/665) [#716](https://github.com/julianhille/MuhammaraJS/issues/716) [#717](https://github.com/julianhille/MuhammaraJS/issues/717) [#796](https://github.com/julianhille/MuhammaraJS/issues/796)
  [#808](https://github.com/julianhille/MuhammaraJS/issues/808) [#853](https://github.com/julianhille/MuhammaraJS/issues/853)
- Add Recipe URL links for arbitrary areas, rendered text, images, and drawing
  bounds, written after the page content stream, clipped with their text to
  `textBox.wrap: "clip"`, and validated in `link()`: non-finite rectangles,
  unsupported URLs, and links between pages throw there instead of in
  `endPage()`, and negative widths and heights cover the same area as native;
  see [Add URL Links](docs/how-to/add-url-links.md) [#614](https://github.com/julianhille/MuhammaraJS/issues/614) [#703](https://github.com/julianhille/MuhammaraJS/issues/703) [#718](https://github.com/julianhille/MuhammaraJS/issues/718)
- Add Recipe `table()` with native's layout: columns derived from every
  record, with `order` entries kept even when the first record lacks them;
  native's default 2pt cell and header padding; fixed heights counted in
  sizing and pagination; header styles resolved independently of body styles;
  a column's `cell` or `row.cell` as the cell text box, with nested styles
  merged; one `renderer` call per cell; and inherited record properties
  treated as missing cells. The `overflow` callback runs with the Recipe as
  `this`, and a continuation area too small for a row and its repeated header
  throws a `RangeError`; see [Create Tables](docs/how-to/create-tables.md)
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666) [#710](https://github.com/julianhille/MuhammaraJS/issues/710)
- Draw Recipe shapes like native: `circle()`, `ellipse()`, `rectangle()`,
  `arc()`, and `pie()` keep their strokes inside positive requested bounds;
  `line()` with fewer than two coordinate pairs draws nothing; `n_gon()` and
  `star()` throw a `RangeError` for a count that is not finite or above
  100000; and a `rotation` that is no number throws a `TypeError` and a
  `miterLimit` below 1 a `RangeError` from shapes, `text()`, `image()`, and
  `lineStyle()`, before anything is drawn [#743](https://github.com/julianhille/MuhammaraJS/issues/743) [#799](https://github.com/julianhille/MuhammaraJS/issues/799) [#821](https://github.com/julianhille/MuhammaraJS/issues/821) [#857](https://github.com/julianhille/MuhammaraJS/issues/857)
- Draw Recipe Separation (spot) colors, as native Recipe does: register an ink
  with `chroma(name, value, "separation")` or pass `colorName` with a
  `separation` color, and shapes, lines, and text paint it at full tint with
  `value` as the alternate device color. Any color name, including
  `__proto__`, can be registered, and an inherited object key used as a
  colorspace throws `TypeError: Unknown colorspace: <name>` [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
- Place images and PDF pages with Recipe `image()` as native Recipe does:
  `page` selects a page of a registered PDF or an image of a TIFF, one-based
  as in `overlay()`; PDF pages are sized by their media box and drawn as
  displayed, honoring `/Rotate` and offset media boxes; `scale` wins over
  `width` and `height`; `rotation` turns around the bottom-left corner unless
  `rotationOrigin` is given; `center` works with `align`; `opacity` applies to
  the image only; a falsy `keepAspectRatio` stretches; `fill`, `stroke`, or
  `color` frame the image, styled by `lineWidth`, `dash`, `dashPhase`,
  `lineCap`, `lineJoin`, and `miterLimit`, and `debug` outlines it. Invalid
  sizes, pages, and colorspaces throw before anything is drawn, and a source
  placed again on an edited page reuses one form; see
  [Place and Transform Images](docs/how-to/place-and-transform-images.md)
  [#857](https://github.com/julianhille/MuhammaraJS/issues/857)
- Add chainable Recipe `deletePage()` for removing pages from an existing PDF,
  validated when it is called, with a `pruneReferences` option that removes
  references to the deleted pages from outlines, link annotations, named
  destinations, form widgets, tagged-PDF structure elements, and the open
  action instead of refusing the deletion; see
  [Delete Pages](docs/how-to/delete-pages.md) [#548](https://github.com/julianhille/MuhammaraJS/issues/548) [#826](https://github.com/julianhille/MuhammaraJS/issues/826) [#829](https://github.com/julianhille/MuhammaraJS/issues/829)
- Add chainable Recipe `pauseContext()` and `resumeContext()` on new and
  edited pages, keeping drawn content across them and across low-level
  page-modifier `endContext()`/`startContext()` calls [#608](https://github.com/julianhille/MuhammaraJS/issues/608) [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Finish Recipe pages and documents like native: `endPDF()` and `appendPage()`
  end an active page; a failed `endPDF()` retires the Recipe and later calls
  rethrow the original error; `rotate()` throws clear errors without an active
  page, for a rotation that is not a multiple of 90, and on pages opened with
  `editPage()`; and `setPageBox()` accepts `PageBox` names such as
  `PageBox.CROP` [#693](https://github.com/julianhille/MuhammaraJS/issues/693) [#732](https://github.com/julianhille/MuhammaraJS/issues/732) [#827](https://github.com/julianhille/MuhammaraJS/issues/827) [#829](https://github.com/julianhille/MuhammaraJS/issues/829)
- Keep the source `/Trapped`, `CreationDate`, `Title`, `Author`, `Subject`,
  and `Keywords` Info entries when a Recipe saves an existing PDF, overridable
  with `info()`, and write `Creator` as
  `Muhammara-Recipe (https://github.com/julianhille/MuhammaraJS)`, recording an
  edited PDF's own creator as `source-Creator` [#779](https://github.com/julianhille/MuhammaraJS/issues/779)
- Add Recipe `replaceText()`, which matches `text` literally through the page
  font, including composite fonts and `/Differences` encodings, inserts
  `replacement` verbatim, keeps other non-ASCII bytes of the content stream
  intact, and throws when the font lacks a needed glyph, cannot be read, or
  the page does not exist; see [Replace Text](docs/how-to/replace-text.md)
  [#622](https://github.com/julianhille/MuhammaraJS/issues/622) [#785](https://github.com/julianhille/MuhammaraJS/issues/785) [#788](https://github.com/julianhille/MuhammaraJS/issues/788)
- Add `Recipe#removeText(pageNumber, { forms })` to remove all shown text from
  an existing page, for example before adding a new OCR text layer; see
  [Replace a Text Layer](docs/how-to/replace-text-layer.md) [#388](https://github.com/julianhille/MuhammaraJS/issues/388) [#829](https://github.com/julianhille/MuhammaraJS/issues/829)
- Add how-to guides for replacing text, including what to do when nothing
  matches or the font lacks a glyph; annotating known text regions with
  Underline or StrikeOut annotations; inspecting PDF dictionaries and their
  indirect objects; reading bookmarks; watermarking in place; adding standard
  and custom Info metadata to an existing PDF; editing and removing existing
  annotations; and the text-extraction budget and page-mark detection, with
  every example runnable as written [#275](https://github.com/julianhille/MuhammaraJS/issues/275) [#290](https://github.com/julianhille/MuhammaraJS/issues/290) [#297](https://github.com/julianhille/MuhammaraJS/issues/297) [#328](https://github.com/julianhille/MuhammaraJS/issues/328) [#370](https://github.com/julianhille/MuhammaraJS/issues/370) [#385](https://github.com/julianhille/MuhammaraJS/issues/385)
  [#450](https://github.com/julianhille/MuhammaraJS/issues/450) [#740](https://github.com/julianhille/MuhammaraJS/issues/740) [#788](https://github.com/julianhille/MuhammaraJS/issues/788)
- Add byte-first documentation parallel to native's: self-contained topic
  pages, a generated API reference from the JSDoc of every public Recipe
  method with named option and result types, built on Read the Docs, notes on
  Recipe `getPageInfo()`, `opacity()`, and `lineStyle()`, the native-only
  writer events and Wasm-only `dispose()` methods, an npm README with tested
  quick-start examples, and third-party notices and security, provenance, and
  contribution guidance [#566](https://github.com/julianhille/MuhammaraJS/issues/566) [#617](https://github.com/julianhille/MuhammaraJS/issues/617) [#618](https://github.com/julianhille/MuhammaraJS/issues/618) [#621](https://github.com/julianhille/MuhammaraJS/issues/621) [#624](https://github.com/julianhille/MuhammaraJS/issues/624) [#626](https://github.com/julianhille/MuhammaraJS/issues/626) [#649](https://github.com/julianhille/MuhammaraJS/issues/649)
  [#652](https://github.com/julianhille/MuhammaraJS/issues/652) [#689](https://github.com/julianhille/MuhammaraJS/issues/689) [#772](https://github.com/julianhille/MuhammaraJS/issues/772)
- Publish versioned, executable browser examples to GitHub Pages for `develop`
  and each release, with a validated guide index, instead of shipping their
  sources in the npm package. Tabs cover tables with optional font uploads,
  password changes, `extractPageContentItems()`, the grayscale form XObject,
  watermarking, finding and highlighting text, and inspecting an uploaded PDF
  [#275](https://github.com/julianhille/MuhammaraJS/issues/275) [#595](https://github.com/julianhille/MuhammaraJS/issues/595) [#613](https://github.com/julianhille/MuhammaraJS/issues/613) [#627](https://github.com/julianhille/MuhammaraJS/issues/627) [#630](https://github.com/julianhille/MuhammaraJS/issues/630) [#684](https://github.com/julianhille/MuhammaraJS/issues/684) [#690](https://github.com/julianhille/MuhammaraJS/issues/690)
- Publish the npm package from tagged releases with a dry run first and a
  validated file list, then create the GitHub release, marked as a
  pre-release for prerelease versions; the native GYP and Wasm CMake builds
  are checked to compile the same PDF-Writer sources, the ABI exports to match
  runtime use, and Emscripten output is cached per build configuration [#568](https://github.com/julianhille/MuhammaraJS/issues/568)
  [#684](https://github.com/julianhille/MuhammaraJS/issues/684) [#690](https://github.com/julianhille/MuhammaraJS/issues/690) [#696](https://github.com/julianhille/MuhammaraJS/issues/696)

[Unreleased]: https://github.com/julianhille/MuhammaraJS/compare/wasm-v1.0.0...HEAD
[1.0.0]: https://github.com/julianhille/MuhammaraJS/releases/tag/wasm-v1.0.0
