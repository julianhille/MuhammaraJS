# Low-Level Writer, Reader, And Modifier

## Writer Lifecycle

`mergePDFPagesToPage` (including its async variant) invokes its optional callback
with no arguments and `globalThis` as `this`, matching native on fresh and
modifying writers. Bound functions retain their bound receiver; arrow functions
retain their lexical `this`.

Finish drawing before calling `writer.end()`. After finalization, disposal, or
a finalization failure, stateful writer methods throw
`Error("PDF writer has ended")`, matching native. Async methods reject their
promises with the same error. Create a new writer for further output and
consume borrowed resources before ending their writer.

`appendPDFPagesFromPDF` also ends a writer or modifier when an underlying PDF
append fails. Create a fresh writer and retry with valid source bytes.

`createPDFDate()` and `createPDFTextString()` create independent values and
remain usable after cleanup. `dispose()` is idempotent; Wasm `end()` still
throws on a second call, whereas native `end()` is a no-op. Recipe uses the
writer guard internally, so there is no additional Recipe method for it.

## Drawing Helpers And Clipping

Page and form contexts on new and modifying writers expose `drawPath`,
`drawCircle`, `drawSquare`, and `drawRectangle`. Their `type` option accepts
`"stroke"` (the default), `"fill"`, or `"clip"`. Clipping intersects the current
clipping region without painting the shape and emits `W n` to end the path.
`close: true` closes the path first. Scope the clip with `q()` before defining it
and `Q()` after the drawing it should affect. Unknown types neither paint nor
clip and end the path with `n`, preventing later drawing from painting their
geometry. Pass a supported type explicitly.

An explicit `type: null` is also unrecognized: it ends the path without painting,
ignores `width` and `close`, and applies a supplied `color` only to the
non-stroking graphics state, matching native. Omit `type` or use `"stroke"` for
an outline; `null` does not select the default.

The TypeScript declarations expose these four values as `DrawingPathType`, so a
misspelled paint mode fails to compile instead of producing unpainted geometry.
The runtime still tolerates any other value for compatibility, but it is not a
supported input.

These helpers validate coordinates and snapshot drawing options before emitting
geometry or graphics-state operators. `writeText` likewise reads its font, size,
color, and underline options before starting text output. Throwing option
getters propagate their original exception without partial output from the
call. Wasm still requires finite numeric coordinates and a font from the same
writer; native retains its historical numeric coercions.

Stroke widths and text sizes must also be finite. Circle control points and
underline endpoints are checked for overflow before drawing. Paths must contain
at least two complete finite coordinate pairs, without holes or extra
arguments. Invalid calls throw without emitting operators; correct the values
and retry on the same context.

## Create A PDF

Create a writer, draw in PDF's bottom-left coordinate system, then retain the
returned bytes:

```js
import { createMuhammaraWasm } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
var page = new muhammara.PDFPage(0, 0, 595, 842);
var writer = muhammara.createWriter({ compress: true });
muhammara.registerFont("inter", fontBytes);
var font = writer.getFontForBytes("inter");
var content = writer.startPageContentContext(page);

content.BT().Tf(font, 24).Tm(1, 0, 0, 1, 72, 720).Tj("Hello").ET();
writer.writePage(page);
var pdfBytes = writer.end();
```

`createReader(bytes)` exposes page counts, page information, PDF objects,
streams, xref data, and raw content-string extraction. Call `end()` when the
reader is no longer needed; parser and object handles are owned by it and become
invalid afterwards. Every reader method that takes a page index or object ID —
`parsePage`, `parsePageDictionary`, `getPageObjectID`, `extractPageText`,
`extractPageContentItems`, `parseNewObject`, and `getXrefEntry` — requires a
non-negative integer below 2^32 and throws a `TypeError` otherwise, exactly as
the native reader does.

`createWriterToModify(bytes, options?)` appends pages or changes an existing
page through `createPageModifier(index?, ensureContentEncapsulation?)`. Its
`end()` returns a new `Uint8Array`. `createModifier(bytes)` is the compact
drawing facade.

A writer created with `createWriterToModify` also exposes
`replaceObject(pageIndex, sourceObjectId, replacementObjectId, options?)`, which
repoints every direct reference to `sourceObjectId` in the zero-based page's
dictionary at `replacementObjectId`. Only that page is rewritten; pass
`{ scope: "global" }` to apply the replacement across every page.

```javascript
var modifyingWriter = muhammara.createWriterToModify(pdfBytes);
modifyingWriter.replaceObject(0, contentsId, replacementId, {
  scope: "global",
});
```

`PDFRStreamForBuffer`, `PDFWStreamForBuffer`, and the `ByteReader`/`ByteWriter`
aliases are byte adapters, not Node or Web streams. A reader adapter's
`read(amount)` returns a copy of at most `amount` bytes as a `Uint8Array`, and
its `setPosition()` and `setPositionFromEnd()` calls clamp the resulting
position to the available byte range. A writer adapter exposes `buffer`,
`toUint8Array()`, `toArrayBuffer()`, and `toBlob()`.

Stream readers returned by `startReadingFromStream()`,
`startReadingFromStreamForPlainCopying()`, `getParserStream()`, and
`getSourceDocumentStream()` return each `read(amount)` as a `Uint8Array` and
allocate Wasm resources. Call their idempotent
`dispose()` method as soon as reading finishes. Disposing one of these byte
readers does not end its parent PDF reader; ending the parent remains fallback
cleanup for byte readers that were not disposed explicitly.

For exact signatures, lifecycle rules, content operators, object contexts,
copying contexts, images, forms, and modifier APIs, use the
[TypeScript reference](reference.md).

Task-oriented low-level guides:

- [Preview, Download, or Upload a PDF](how-to/serve-a-pdf-response.md)
- [Find Text Positions](how-to/find-text-positions.md)
- [Inspect PDF Objects](how-to/inspect-pdf-objects.md)
- [Read PDF Bookmarks](how-to/read-bookmarks.md)
- [Add Clickable URL Links](how-to/add-url-links.md)
- [Set Page Boxes](how-to/set-page-boxes.md)
