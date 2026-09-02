# PDF Reader And Objects

`muhammara.createReader(input, options)` returns a `PDFReader` for a file path
or compatible random-access read stream.

The reader provides document information with `getPDFLevel`, `getPagesCount`,
`getTrailer`, and `isEncrypted`; page access with `parsePage`,
`parsePageDictionary`, and `getPageObjectID`; and object access with
`parseNewObject`, `queryDictionaryObject`, and `queryArrayObject`.

`extractPageText(pageIndex)` returns content-stream text operations in drawing
order. Each `PDFTextElement` includes raw `content`, `fontResource`, `fontSize`,
and a six-value `textMatrix`; it does not decode font character maps or compute
glyph bounds.

Parsed `PDFObject` values expose `getType`, conversion methods such as
`toPDFDictionary()` and `toPDFArray()`, and scalar conversion through
`toNumber()` and `toString()`. A dictionary provides `exists`, `queryObject`,
and `toJSObject`; an array provides `getLength`, `queryObject`, and `toJSArray`.
Use reader query helpers when an entry may be an indirect reference and must be
resolved.

[`tests/PDFParser.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/PDFParser.js) covers reader creation, page inspection, trailer traversal,
and object conversion.

For a complete reader workflow, see [Read PDFs](../low-level/read-pdfs.md).
