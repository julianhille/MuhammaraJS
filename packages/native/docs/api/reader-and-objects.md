# PDF Reader And Objects

`muhammara.createReader(input, options)` returns a `PDFReader` for a file path
or compatible random-access read stream.

The reader provides document information with `getPDFLevel`, `getPagesCount`,
`getTrailer`, and `isEncrypted`; page access with `parsePage`,
`parsePageDictionary`, and `getPageObjectID`; and object access with
`parseNewObject`, `queryDictionaryObject`, and `queryArrayObject`.

`extractPageText(pageIndex, limits?)` returns content-stream text operations in
drawing order. Each `PDFTextElement` includes raw `content`, `fontResource`,
`fontSize`, and a six-value `textMatrix`; it does not decode font character maps
or compute glyph bounds.

`extractPageContentItems(pageIndex, limits?)` returns every direct
content-stream operation that puts a mark on the page as `{ type, operation }`,
which answers "is this page blank?" without extracting text.

Both accept the same optional `limits` object. Omitted fields keep the built-in
default, and values above it are clamped down, so a caller can tighten the
extraction budget but never raise it past the ceiling the extractor enforces.
See [Find Text Positions](../how-to/find-text-positions.md) for the field table.

Parsed `PDFObject` values expose `getType`, conversion methods such as
`toPDFDictionary()` and `toPDFArray()`, and scalar conversion through
`toNumber()` and `toString()`. A dictionary provides `exists`, `queryObject`,
and `toJSObject`; an array provides `getLength`, `queryObject`, and `toJSArray`.
Use reader query helpers when an entry may be an indirect reference and must be
resolved.

```javascript
var reader = muhammara.createReader("input.pdf");
var pageCount = reader.getPagesCount();
var firstPage = reader.parsePage(0);
```

[`tests/PDFParser.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/PDFParser.js) covers reader creation, page inspection, trailer traversal,
and object conversion.

For a complete reader workflow, see [Read PDFs](../low-level/read-pdfs.md).
