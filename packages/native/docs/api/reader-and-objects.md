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

Every method that takes a page index or object ID — `parsePage`,
`parsePageDictionary`, `getPageObjectID`, `extractPageText`,
`extractPageContentItems`, `parseNewObject`, and `getXrefEntry` — requires a
non-negative integer below 2^32 and throws a `TypeError` otherwise. Negative and
fractional values are rejected rather than coerced, so `parsePage(-1)` throws
instead of reading a wildly out-of-range page.

Parsed `PDFObject` values expose `getType`, conversion methods such as
`toPDFDictionary()` and `toPDFArray()`, and scalar conversion through
`toNumber()` and `toString()`. A dictionary provides `exists`, `queryObject`,
and `toJSObject`; an array provides `getLength`, `queryObject`, and `toJSArray`.
Use reader query helpers when an entry may be an indirect reference and must be
resolved.

`end()` releases the reader and the file handle behind it. Call it once every
parsed object and stream has been consumed; until then the input file stays
open, and Windows refuses to rename or delete it.

```javascript
var reader = muhammara.createReader("input.pdf");
var pageCount = reader.getPagesCount();
var firstPage = reader.parsePage(0);
reader.end();
```

[`tests/PDFParser.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/PDFParser.js) covers reader creation, page inspection, trailer traversal,
and object conversion.

For a complete reader workflow, see [Read PDFs](../low-level/read-pdfs.md).
