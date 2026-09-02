# Muhammara WebAssembly

This target compiles the reusable C++ `PDFWriter` core for browser, worker, and
Node WebAssembly runtimes. It does not compile the Node/V8 binding, so its API
is intentionally separate from `require("@muhammara/native")`.

For Node.js filesystem paths, streams, and the full native PDF API, use
[`@muhammara/native`](https://muhammarajs.readthedocs.io/). Use
`@muhammara/native-with-source` when the native addon needs a local or Electron
build. It can also be installed as the `@muhammara/native` npm alias when an
application must keep that import name.

## Build

The build requires Docker and pulls `emscripten/emsdk:3.1.74` on first use:

```sh
npm run wasm:build
```

This writes `packages/wasm/dist/muhammara-wasm.js` and
`packages/wasm/dist/muhammara-wasm.wasm`.

Within this repository, Wasm is the `@muhammara/wasm` npm workspace. Run its
commands either through the root aliases, such as `npm run wasm:build`, or
directly with `npm run build --workspace=@muhammara/wasm`. The workspace Mocha
commands execute from the repository root so they can share the native fixture
files under `packages/native-with-source/tests/TestMaterials`.

## Use

```js
import { createMuhammaraWasm } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
var pdfBytes = muhammara.createBlankPdf(595, 842);
```

`pdfBytes` is a standalone `Uint8Array` and can be passed to `Blob`, downloaded,
or uploaded without depending on Emscripten memory after the call returns.

All byte-taking APIs synchronously accept `Uint8Array` and `ArrayBuffer`. When
hosted by Node, `Buffer` is incidentally accepted as a `Uint8Array` subclass;
it is not a browser API or separate Wasm input contract. `Blob` and `File`
require the matching `Async` method because reading them is asynchronous. The
low-level API provides explicit async counterparts for
reader/modifier creation, asset registration, PDF copying/form creation,
append/merge, image dimensions/type/page count/JPEG metadata, TIFF form
creation, and `ContentContext.drawImage`. Async methods also accept byte
sources. `createWriterToModifyAsync(pdf, { version?, compress? })` forwards
the same browser-safe options as its synchronous counterpart. Recipe
registration has the equivalent `Recipe.registerFontAsync`, `registerImageAsync`,
and `registerPdfAsync` methods.

`PDFRStreamForBuffer` and `PDFWStreamForBuffer` are browser-safe byte adapters
available both as module exports and from a loaded Muhammara instance. The
reader provides the familiar cursor methods; the writer accepts bytes and
keeps its current `Uint8Array` in `buffer`, with owned output also available
through `toUint8Array()`, `toArrayBuffer()`, or `toBlob()`.

`ByteReader`, `ByteReaderWithPosition`, `ByteWriter`, and
`ByteWriterWithPosition` provide the corresponding low-level byte interfaces
over `Uint8Array`/`ArrayBuffer`; they do not expose filesystem-backed
`InputFile` or `OutputFile`. Browser callers provide input bytes and retain
output bytes themselves.

## Low-Level Writer

`createMuhammaraWasm()` also exposes a byte-first subset of the low-level writer
API. `PDFPage` and content coordinates use PDF's native bottom-left origin:

```js
var muhammara = await createMuhammaraWasm();
var page = new muhammara.PDFPage(0, 0, 595, 842);
var writer = muhammara.createWriter({ compress: true });
// Fonts are registered by bytes; no public API accepts a filesystem path.
muhammara.registerFont("arial", fontBytes);
var font = writer.getFontForBytes("arial");
var content = writer.startPageContentContext(page);

content.q().k(100, 0, 0, 0).re(100, 500, 100, 100).f().Q();
content.BT().Tf(font, 24).Tm(1, 0, 0, 1, 72, 720).Tj("Hello").ET();
writer.pausePageContentContext(content);
content.q().G(0.5).w(3).m(200, 600).l(400, 400).S().Q();
var pageObjectId = writer.writePageAndReturnID(page);
var pdfBytes = writer.end();
```

`writePageAndReturnID(page)` has the same active-page validation and context
finalization behavior as `writePage(page)`, and returns the positive numeric
indirect object ID assigned to that write. A `PDFPage` remains reusable, so a
subsequent write of the same page returns a distinct ID.

`createWriter({ compress: false })` passes the setting directly to the native
writer's creation settings, so automatically created streams are emitted without
the `/FlateDecode` filter. Compression defaults to `true`. This is distinct from
`writer.getObjectsContext().setCompressStreams(value)`, which changes the mode
for subsequent raw object streams after writer creation.

Writers expose Node-named `createPDFTextString()` and `createPDFDate()`
factories. `PageContentContext.getAssociatedPage()` returns its active
`PDFPage`. Image and form XObject wrappers expose their positive native `id`.

The supported context operators include path/graphics operators plus `BT`, `ET`,
`Tf`, `Tm`, `Tj`, rendering intent `ri(name)`, flatness `i(value)`, graphics
state `gs(name)`, color-space selection `CS(name)`/`cs(name)`, and color
components `SC(...components)`/`sc(...components)` and
`SCN(...components, patternName?)`/`scn(...components, patternName?)`; every
operator is chainable. Names are strings and color components must be finite
numbers; `SCN`/`scn` also accept their components as one array. Add ExtGState,
ColorSpace, and Pattern resource mappings before using their returned names.
These structured operators are available on page, open form, and active
page-modifier contexts.
`writeFreeCode` writes UTF-8 string bytes directly through native
`AbstractContentContext::WriteFreeCode` on page, open form, and active page-modifier
contexts. It is for deliberate raw PDF content only; structured operators remain
explicit methods. `Tj` accepts UTF-8 text or
`[glyphId, unicodeCodePoint]` pairs. `font.calculateTextDimensions(text, size)`
returns native text bounds and dimensions, while `font.getFontMetrics(size)`
returns native FreeType metrics. `pausePageContentContext` finalizes the current
content stream while allowing the same context to continue writing.

`PageContentContext.getCurrentPageContentStream()` and open
`FormXObject.getContentStream()` return borrowed native `PDFStream` wrappers.
Their `getWriteStream().write(bytes)` accepts only `Uint8Array` or `ArrayBuffer`,
writes arbitrary binary bytes without UTF-8 encoding, and returns the native byte
count. These are not Node or Web stream wrappers. A page stream becomes invalid
when its context pauses or finalizes, its page is written, or its writer ends; a
form stream becomes invalid when the form or writer ends. Use `writeFreeCode` for
UTF-8 PDF source text, and content-stream writers for exact byte sequences.

Page, open form, and active page-modifier content contexts also expose
`drawImage(x, y, assetNameOrBytes, options?)`. Asset names refer to images
registered with `registerImage` (JPEG, PNG, or TIFF) or PDFs registered with
`registerPdf`; direct inputs are `Uint8Array` or `ArrayBuffer` containing JPEG,
PNG, TIFF, or PDF data. Direct bytes are retained internally until `end()` has
completed the scheduled native write. Options are limited to zero-based
`index` and `transformation`: a six-number matrix or
`{ width, height, proportional?, fit?: "always" | "overflow" }`. Node
password, path, and stream options are explicitly unsupported.

`writer.getObjectsContext()` exposes opaque `ObjectsContext`,
`DictionaryContext`, and `PDFStream` handles for raw indirect-object output.
Stream and free-context writers accept `Uint8Array`; dictionaries and streams
must be closed in LIFO order before ending the writer.

`PDFPage.getResourcesDictionary()` and open `FormXObject.getResourcesDictionary()`
provide the native resource additions needed for raw page/form content:
`addProcsetResource`, `addExtGStateMapping`, `addFontMapping`,
`addColorSpaceMapping`, `addPatternMapping`, `addPropertyMapping`,
`addXObjectMapping`, `addFormXObjectMapping`, `addImageXObjectMapping`, and
`addShadingMapping`. Mapping methods take an indirect object ID and return the
native resource name. `PDFPageModifier.getResourcesDictionary()` provides the
same operations while modifying an existing page.
`FormXObject.getResourcesDictinary()` is retained as a spelling-compatible alias.

Open `FormXObject` content contexts have the same low-level path, paint, line,
device-color, clipping, opacity, XObject, text, and structured-content
operators as page and active modifier contexts. `Tf` accepts either a
writer-owned font handle or a resource name returned by `addFontMapping` on all
three contexts. They also provide `drawPath`,
`drawCircle`, `drawSquare`, `drawRectangle`, and `writeText` with the same
validation and output semantics. Form contexts and resources become stale at
`endFormXObject`; page-only `getAssociatedPage()` and
`getCurrentPageContentStream()` do not apply to forms.
Byte-backed modifiers expose the same open-form lifecycle, including content
contexts, resources, content-stream byte writes, and optional object IDs.
Modifier TIFF forms accept the same byte-safe `pageIndex`, `objectId`,
`bwTreatment`, and `grayscaleTreatment` options as writers. New modifier pages
also expose their associated page and current content stream while active.

Byte-registered image and form XObjects support forward references. Allocate an
ID, add the matching page/form resource mapping, and place its returned name
before defining the XObject. The browser signatures are
`createImageXObjectFromJPGBytes(name, objectId?)`,
`createFormXObjectFromJPGBytes(name, objectId?)`,
`createFormXObjectFromPNGBytes(name, objectId?)`,
`createFormXObjectFromTIFF(imageNameOrBytes, { pageIndex?, objectId?, bwTreatment?, grayscaleTreatment? })`, and
`createFormXObject(left, bottom, right, top, objectId?)`. `objectId` must be a
positive 32-bit integer, normally from `getObjectsContext().allocateNewObjectID()`.
TIFF retains zero-based `pageIndex` when `objectId` is supplied. `bwTreatment`
accepts `{ asImageMask?, oneColor? }`; `grayscaleTreatment` accepts
`{ asColorMap?, oneColor?, zeroColor? }`. Colors are RGB three-component or
CMYK four-component integer arrays in the range 0 through 255.

`writer.retrieveJPGImageInformation(assetNameOrBytes)` accepts a registered JPEG
asset or direct `Uint8Array`/`ArrayBuffer` JPEG bytes. It returns Node-shaped
`samplesWidth`, `samplesHeight`, `colorComponentsCount`, and JFIF, Exif, and
Photoshop existence flags; each format's density fields are included only when
its flag is true. Paths and streams are unsupported.

`getImageType` and `getImageTypeAsync` return the Node-compatible `"JPG"`,
`"PNG"`, `"TIFF"`, or `"PDF"` labels, not the MIME-style `"JPEG"` label.

`writer.getImageDimensions(assetNameOrBytes, imageIndex = 0)` accepts a
registered JPEG/PNG/TIFF image or PDF asset, or direct `Uint8Array`/`ArrayBuffer`
bytes for those formats. `imageIndex` is a non-negative 32-bit TIFF directory or
PDF page index. `await writer.getImageDimensionsAsync(blobOrFile, imageIndex?)`
accepts `Blob`/`File`. Unlike Node's path-or-stream method, Wasm always calls the
core byte-stream overload; password options and encrypted PDF dimension reads are
not supported.

`writer.createFormXObjectsFromPDF(registeredNameOrBytes, pageBox?, options?)`
creates forms for all pages or the zero-based inclusive `specificRanges`.
`pageBox` may instead be a custom crop `[left, bottom, right, top]`; options
support `transformation: [a, b, c, d, e, f]` and
`additionalObjectIds: [sourceObjectId, ...]`. Coordinates and matrix entries
must be finite; additional IDs must be non-negative 32-bit integers. Registered
and direct inputs both use the core byte-stream overload. Passwords, filesystem
paths, and Node streams remain unsupported.

`writer.appendPDFPagesFromPDF(sourceBytes, options?)` directly appends pages
from `Uint8Array` or `ArrayBuffer` input and returns the copied page object IDs.
It accepts `type: eRangeTypeSpecific` with zero-based, inclusive
`specificRanges`, or all pages by default. `await
writer.appendPDFPagesFromPDFAsync(blobOrFile, options?)` accepts `Blob`/`File`.
Encrypted inputs and password options are unsupported. This is an immediate
writer operation, unlike `createPDFCopyingContext`, which remains a separate
stateful API for incremental page, form, merge, and object-copy operations.

`writer.mergePDFPagesToPage(targetPage, sourceBytes, options?)` directly merges
all source pages, or zero-based inclusive `specificRanges`, into a target page
and returns the writer. The target may be supplied before its content context
starts or while it is active, so content can follow the merge. `await
writer.mergePDFPagesToPageAsync(targetPage, blobOrFile, options?)` accepts
`Blob`/`File`. The target must be the writer's active page when one exists.
Node callback and event APIs are excluded, including the Node per-source-page
merge callback and EventEmitter hooks. The browser-safe direct-merge completion
callback may be passed as the third argument, or after options as the fourth
argument. It runs once after the full synchronous native merge succeeds, while
the target page remains active. Passwords, encrypted sources, filesystem paths,
and Node streams are excluded. Unlike `createPDFCopyingContext`, this is an
immediate operation, not a stateful copying context for incremental
page/form/object operations.

While a page is active, low-level writers expose
`attachURLLinktoCurrentPage(url, left, bottom, right, top)` and
`createAnnotation(subtype, left, bottom, right, top, options)`. Page modifiers
provide the same methods after `startContext()`. Annotation options are
`contents`, `title`, `name`, `color` (one, three, or four components),
`borderWidth`/`borderDash` (or `border: { width, dash }`), `quadPoints`,
`flags`, `open`, and `opacity`. `quadPoints` must contain complete eight-number
quadrilaterals. For raw annotation dictionaries,
`registerAnnotationReferenceForNextPageWrite(objectId)` remains available on a
writer. Annotation geometry uses native PDF coordinates; no path or encryption
API is introduced.

`getFontForBytes(name, index?)` accepts a registered font asset and a zero-based
collection face index. For Type 1, use
`getFontForBytes(name, metricsName, index?)`, where `metricsName` identifies a
registered PFM asset. These mirror the Node overload order while keeping all
assets byte-registered. TTC and byte-serializable DFont assets are supported
through FreeType's collection face selection. Wasm cannot resolve a macOS
installed font or a resource fork supplied separately from the DFont bytes;
provide the complete DFont file bytes or extract an individual TTF/OTF face.

## Browser Recipe

The browser-native Recipe API is asynchronous to load WebAssembly and accepts
byte assets instead of filesystem paths:

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
Recipe.registerFont("inter", new Uint8Array(await fontFile.arrayBuffer()));
var bytes = new Recipe()
  .createPage(595, 842)
  .text("Hello", 72, 720, { font: "inter", fontSize: 24 })
  .rectangle(72, 680, 120, 24, { fill: "#dbeafe" })
  .endPage()
  .endPDF();
```

Recipe foundation defaults to US Letter (`612 x 792`) with 72-point margins on
all sides. `new Recipe({ version: 1.0 | ... | 1.7, compress?: boolean })` selects
the output PDF version (default `1.7`) and compression. Integer enums `10`
through `17` remain a browser byte-first extension; invalid values, including
`2.0`/`20`, normalize to `1.7`. `createPage()` uses
those Letter defaults; named sizes include the original executive, folio,
legal, letter, ledger/tabloid, A/B/C, RA, and SRA catalogues. `margins()` gets a
copy of the current margins, while its object or four-number setter changes only
the supplied sides. Recipe coordinates remain top-left; `"center"` is accepted
by the foundation coordinate helpers and media-box offsets are normalized for
high-level drawing. Rotated source pages use the same swapped Recipe width and
height as Node Recipe, and `position` tracks `moveTo` and `lineTo` coordinates.
`createPage()` starts at the Node-compatible `(0, 0)` cursor; implicit text and
layout continue to use margins.
Byte-source Recipes support editing with polygon-derived shapes, creating new
pages, and appending registered PDF bytes through the byte-backed modifier.
`Recipe.registerFont(family, bytes, style?)` accepts `regular`, `bold`,
`italic`, or `bold-italic` byte faces and text selection uses `bold`/`italic`
options. `recipe.registerFont(name, bytes, type?)` and its Blob/File async
counterpart provide the same byte-first registration on an instance.
`recipe.htmlToTextObjects(html, options?)` exposes the Worker-safe HTML runs used
by `text(..., { html: true })`. `read(bytes)` only inspects page metadata and
does not replace the current PDF; construct with bytes to edit a source PDF.
`endPDF(callback?)` is idempotent, returns the same cached `Uint8Array`, and
passes that in-memory array to its optional callback. New PDFs receive creation
and modification dates plus canonical MuhammaraJS Producer and Hummus-Recipe
Creator values. Editing preserves source creation metadata and records source
modification, producer, and creator values as `source-*` Info entries.

The creation milestone supports `createPage`, `endPage`, `text`, `line`,
`rectangle`, `circle`, `polygon`, `ellipse`, `arc`, `pie`, `n_gon`, `star`, `info`,
`custom`, `link`, `comment`, `annot`, `image`, `endPDF`,
`Recipe.registerFont`, `Recipe.registerImage`, `Recipe.registerPdf`, and
`appendPage` (all registered PDF pages or one-based page ranges), `overlay`,
`arrow`, and `triangle` (`sss`, `sas`, `asa`, and vertices).
Coordinates use Recipe's top-left origin. Annotations are queued until
`endPage`, including comment/markup fields, replies, rich text, and rotated
coordinates. `endPDF` returns a `Uint8Array`.

`setPageBox(box, left, bottom, right, top)` and `rotate(degrees)` configure the
current page. Page-box coordinates use the native PDF bottom-left origin.

`Recipe.splitPdf(name, prefix)` and `recipe.split(prefix)` split registered or
completed Recipe PDFs into `[{ name, bytes }]`, avoiding filesystem output in
browser environments. `insertPage(afterPage, registeredName, sourcePage)` is
deferred until `endPDF()` and rebuilds bytes in memory. `info()` returns Recipe
metadata written through `info(options)` and `custom(key, value)`; `structure()`
returns legacy-style text or `structure("json")` returns a byte-safe summary.
`permission(flags)` is a pure permission-bit helper. `encrypt()` always throws
because this build intentionally excludes OpenSSL.

`Recipe.inspectPdf(name)` returns page count, PDF level, encryption state, and
per-page media box, rotation, dimensions, layout, and offsets.

Recipe is byte-first: constructors create new in-memory PDFs, and registered
fonts, images, and PDFs are supplied as `Uint8Array`/`ArrayBuffer` (or Blob/File
to an `Async` registration method). It has no Node plugin loader, no path or
stream constructor arguments, or filesystem font discovery. The callback form
of `endPDF` is browser-safe and receives in-memory bytes. In Node, `Buffer`
works only because it subclasses `Uint8Array`; it is not a separate Recipe
contract.

`Recipe.register(name, callback)` (or a named callback) adds a synchronous
Recipe prototype extension for the loaded Recipe constructor. It does not load
Node Recipe plugins or provide a filesystem hook.

Recipe `chroma(name, value, colorspace?)` accepts named colors, `#` hex, `%`
component lists, and byte component arrays for gray, RGB, and CMYK. Shapes share
line width/cap/join/dash/miter, opacity, color, rotation, and skew options.
Registered images support sizing, proportional fitting, alignment, opacity,
rotation, skew, TIFF directory `index`, and repeated placement through the core
image cache. `chroma("!load", path)` and Separation colors are unsupported in
Recipe WebAssembly: the former is Node filesystem loading and the latter requires
Recipe-created Separation resource dictionaries. Use the byte-safe low-level
writer resource API for Separation colors. No Node path, plugin, stream, or font
discovery loader is provided.
Editing byte-backed PDFs supports links, registered images, and actual PDF
clipping for `textBox.wrap: "clip"` through the active modifier context.

Appending or rebuilding registered PDF pages preserves page content but does not
deep-copy an existing source page's `/Annots` graph. Recipe annotations created
on the output itself are written normally at `endPage()`.

`save`, `restore`, `transform(a, b, c, d, e, f)`, and
`rotateContent(degrees, x, y)` provide scoped content transformations.
`lineStyle({ width, cap, join, miterLimit, dash, dashPhase })` configures the
current graphics state. `opacity(value)` applies a fill and stroke alpha value.

Recipe text also supports registered-font metrics, `charSpace`, top-level
alignment, visual `hilite`, text boxes (`clip` retains the source for PDF
clipping, `trim` omits the non-fitting suffix, and ASCII `ellipsis` writes
`...`; plus padding, justification, alignment, fill and border), flowed text,
multi-column `layout`, Worker-safe HTML text, markup decorations, transforms,
and tables with 100pt default columns, wrapping-aware header/cell measurement,
`header.alignToData`, per-column `hcell` overrides, row styling, borders,
renderer callbacks, and continuation callbacks that repeat headers without
overlapping the next row. See [DIFFERENCES.md](DIFFERENCES.md) for the precise
browser-safe subset and intentional Node/plugin differences.

`createMuhammaraWasm()` also provides a byte-based reader with `getPDFLevel`,
`getPagesCount`, `getPageObjectID(index)`, `getPageInfo(index)`,
`extractPageText(index)`, and `end`. `extractPageText` returns Node-shaped
`{ content, fontResource, fontSize, textMatrix }` entries in content-stream
drawing order, with the same 1,000,000 parsed-object, 100,000 entry, and 16 MiB
text safety limits. Like Node, `content` is raw PDF string bytes represented as
one-byte JavaScript code units, not font or ToUnicode-decoded text.
`reader.parsePage(index)` returns a reader-owned native `PDFPageInput` handle
with Node-equivalent `getDictionary`, `getMediaBox`, `getCropBox`,
`getTrimBox`, `getBleedBox`, `getArtBox`, and `getRotate`. Box inheritance and
fallback values are evaluated by the core `PDFPageInput`; `getDictionary()` is
the existing parsed dictionary handle, not a reconstructed JS value. Reader,
writer, modifier, parser, form, and parsed page handles reject operations after
they are ended. Reader and parser `end()` calls are idempotent.
`startReadingObjectsFromStream(stream)` and
`startReadingObjectsFromStreams(streams)` return native `PDFObjectParser`
wrappers for a reader-owned content stream or `PDFArray` of content streams;
the plural form reads the streams in array order. It accepts no JavaScript or
Node stream adapters, and rejects foreign or stale parsed handles.
Parsed `PDFLiteralString` and `PDFHexString` handles provide `toBytesArray()`;
in Wasm it returns an owned `Uint8Array` of decoded PDF bytes, preserving NUL
and non-UTF-8 values. Their `toText()` decodes those raw bytes directly, without
a lossy UTF-8 decode/re-encode round trip. Node uses `toBytesArray()` with the
same name but returns `number[]`. `getXrefEntry(objectId)` returns Node-shaped
`objectPosition`, `revision`, and `type` keys; the former Wasm-only `position`
key is not retained.
`getParserStream()` returns a reader-owned, non-owning native random-access byte
handle over the core parser stream. It exposes `read`, `notEnded`, `setPosition`,
`setPositionFromEnd`, `skip`, and `getCurrentPosition`, and becomes invalid when
its reader ends. `startReadingFromStream(stream)` returns a reader-owned byte reader for decoded
stream bytes, while `startReadingFromStreamForPlainCopying(stream)` returns the
stored bytes after supported decryption but without filter decoding. Both expose
numeric-array `read(amount)` and `notEnded()`, reject foreign or stale
`PDFStreamInput` handles, and become invalid when their reader ends. These are
native PDF stream byte readers, not JavaScript, Node, or Web stream adapters.
`getParserStream()` is likewise a native byte handle, not a JavaScript, Node, or
Web stream adapter.

It also provides `createWriterToModify(pdfBytes, { version?, compress? })`, a byte-first facade for the
Node writer-to-modify flow. It can append `PDFPage`s through
`startPageContentContext`/`writePage`, modify an existing page through
`createPageModifier(index?, ensureContentEncapsulation?)`, and returns bytes from
`end()`. The index defaults to zero; setting `ensureContentEncapsulation` wraps
the modified page's added content as in the native API. Its active contexts
expose the low-level graphics and text operators, including `BT`, `Tf`, `Tm`,
`Tj`, opacity and XObject placement, plus `drawPath`, `drawCircle`,
`drawSquare`, `drawRectangle`, and `writeText`. Fonts use `getFontForBytes` with
registered font bytes or mapped resource names. Modifier resources are available
only while their context is active and become stale at `endContext()`.

The modifier also reuses native writer operations where they are byte-safe:
`createPDFTextString`, `createPDFDate`, `getDocumentContext().getInfoDictionary()`,
links and annotations for active new or modified pages,
`pausePageContentContext`, `writePageAndReturnID`, JPEG/PNG byte XObjects, image
inspection, TIFF/PDF form creation, and direct append/merge with Blob/File async
variants. `compress` applies to newly written streams. `version` is passed to
native `ModifyPDFForStream`, but the core preserves the modified input's PDF
header level, so it does not promise an output-version conversion. Completed
JPEG/PNG/TIFF form handles expose only `id`. Writer-owned generic forms expose
the byte-safe content context, resource dictionary, content-stream writer, and
image helpers, and must be closed with `writer.endFormXObject(form)`.
Modifier-owned generic forms additionally expose `form.end()`;
`modifier.endFormXObject(form)` is its modifier-level equivalent.

`createPDFCopyingContext(sourcePdfBytes)` is native-backed and provides
`appendPDFPageFromPDF(index)` returns the copied page object ID;
`appendPDFPagesFromPDF(start, end)` returns the copying context,
`mergePDFPageToPage(targetPage, index)`, and
`createFormXObjectFromPDFPage(index, pageBoxOrCrop, transformation?)`, which
returns the copied form object ID. `pageBoxOrCrop` is a page-box enum or four
finite crop coordinates, and `transformation` is an optional six-number matrix.
Pass the returned ID to `doXObject(id)` to map and place the form. It can also merge a source page
into an open generic form with `mergePDFPageToFormXObject(form, index)`. A
copying context used for an open form must remain open until `endFormXObject`.
Its page merges may be interleaved with the target new-page content context.
This is separate from direct `writer.mergePDFPagesToPage`, which takes source
bytes and completes the full merge in one call. The older `createModifier`
remains available as a compact drawing facade.

`DocumentCopyingContext.getSourceDocumentParser()` is a copying-context-owned
reader view with the same browser-safe parser surface as `createReader`: page,
trailer, xref, encryption, object, page-input, stream-byte-reader, object-stream
parser, and parsed-object APIs. Parsed objects retain their exact copying-context
ownership, so they can be passed to direct-object copy APIs but never to another
context. `getSourceDocumentStream()` returns a positioned native byte reader
(`read`, `notEnded`, `setPosition`, `setPositionFromEnd`, `skip`, and
`getCurrentPosition`), never a Node, Web, or filesystem stream. Both views and
all of their derived handles become unusable when the copying context or owning
writer ends; ending a source parser view only ends that view.

External-source and modified-file copying contexts from
`createWriterToModify(pdfBytes)` provide `createFormXObjectFromPDFPage` and
`mergePDFPageToFormXObject`. External-source page merges may be interleaved with
active modifier content. The
modifier exposes `createFormXObject(left, bottom, right, top)` as a
same-modifier open form. Call `form.end()` or `modifier.endFormXObject(form)`
before the copying context or modifier ends.

`createWriterToModify(pdfBytes).getModifiedFileParser()` returns the original
byte-backed document through the same reader API, including page, object, xref,
trailer, and native byte-reader queries. It is available only while that
modifier is active. The view is non-owning: its `end()` only ends that view and
does not close the modifier's core parser. Ending the modifier invalidates every
such view and all page, object, trailer, and byte-reader handles derived from it.

`replaceObject(pageIndex, sourceObjectId, replacementObjectId)` replaces matching
direct references in one original page dictionary. The zero-based page index and
both positive object IDs must be unsigned 32-bit values from the modified PDF:
the source is resolved against its original document and the replacement is an
existing or allocated object ID from that modifier's objects context. It is not
available while a page context is active or after `end()`.

## Scope and Evaluation

The target verifies the C++ writer and bundled zlib/FreeType/AES dependencies
in a browser-safe configuration. OpenSSL encryption is disabled: encrypted
writers, decryption, and `recrypt` are unavailable. Public APIs never accept
Node filesystem paths, `Buffer`, Node streams/callbacks, `InputFile`/`OutputFile`,
EventEmitter extension hooks, or synchronous CommonJS loading; callers provide
and retain bytes, while Emscripten FS is internal only. DFont inputs must include
their complete file bytes as described above. JPEG, PNG, and TIFF byte imports are
enabled.
Existing-PDF reading/modification and byte-backed copying are available, while
persistent-file continuation and Node's path-based Recipe constructor remain
unavailable. Extending byte-oriented C++ bindings is preferable to porting the
V8 drivers.

Run `npm run wasm:test` after building to run the Mocha Wasm suite and
`npm run wasm:test:types` to type-check its executable low-level API coverage.
`npm run wasm:test:browser` starts a local static server and headless Chrome,
then waits for a structured result from both a page and module Worker. Set
`CHROME_BIN` to the Chrome executable; CI provisions it with
`browser-actions/setup-chrome`. The runner uses `puppeteer-core` for browser
automation.
Low-level
tests are in `packages/wasm/tests/` and use names matching their closest
`packages/native-with-source/tests/*.js`
counterparts. Recipe ports are grouped by Node Recipe category in
`packages/wasm/tests/recipe/`; parser security regressions are in
`packages/wasm/tests/security/`. The Recipe tests share one cached Wasm
initialization through `packages/wasm/tests/recipe/recipe.mjs`.

`packages/wasm/tests/browser/` contains the real-browser harness. Its shared assertions
exercise byte adapters plus byte-first writer, reader, generic Form XObject
lifecycle/resources/content streams, and modifier operations; the page reports
only after its Worker has completed the same assertions. The browser-side modules
use browser ESM and no Node filesystem APIs. The GitHub Actions Wasm job runs
the build, smoke, unit, declaration, and Chrome page/Worker commands.

## Demo

After `npm run wasm:build`, run `npm run wasm:server:browser` and open
`http://127.0.0.1:8080/`. The browser example uses a server that supplies the
required Wasm MIME type and demonstrates both low-level and Recipe workflows.
