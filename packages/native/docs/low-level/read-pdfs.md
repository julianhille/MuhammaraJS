# Read PDFs

Create a reader for a file or compatible input stream, inspect it, and release
its resources when finished.

```javascript
var muhammara = require("@muhammara/native");
var reader = muhammara.createReader("input.pdf");

console.log(reader.getPagesCount());
```

Readers provide page counts, PDF level, trailers, page dictionaries, and
low-level PDF objects. `parsePage(index)` exposes page boxes and rotation;
`parseNewObject(id)` returns a PDF object that can be converted with methods
such as `toPDFDictionary()` or `toPDFArray()`.

`extractPageText(index)` enumerates text-showing operations with their text
matrix and active font state. It does not provide general visual-text or
image-extraction. See [Find Text Positions](../how-to/find-text-positions.md),
`tests/PDFTextExtractionTest.js`, and `tests/PDFParser.js` for verified usage.
