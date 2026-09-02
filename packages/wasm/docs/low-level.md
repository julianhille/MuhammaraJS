# Low-Level Writer, Reader, And Modifier

Create a writer, draw in PDF's bottom-left coordinate system, then retain the
returned bytes:

```js
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
invalid afterwards.

`createWriterToModify(bytes, options?)` appends pages or changes an existing
page through `createPageModifier(index?, ensureContentEncapsulation?)`. Its
`end()` returns a new `Uint8Array`. `createModifier(bytes)` is the compact
drawing facade.

`PDFRStreamForBuffer`, `PDFWStreamForBuffer`, and the `ByteReader`/`ByteWriter`
aliases are byte adapters, not Node or Web streams. A writer adapter exposes
`buffer`, `toUint8Array()`, `toArrayBuffer()`, and `toBlob()`.

For exact signatures, lifecycle rules, content operators, object contexts,
copying contexts, images, forms, and modifier APIs, use the
[TypeScript reference](reference.md).

Task-oriented low-level guides:

- [Preview, Download, or Upload a PDF](how-to/serve-a-pdf-response.md)
- [Find Text Positions](how-to/find-text-positions.md)
- [Add Clickable URL Links](how-to/add-url-links.md)
- [Set Page Boxes](how-to/set-page-boxes.md)
