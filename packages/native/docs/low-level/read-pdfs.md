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

`extractPageText(pageIndex, limits?)` enumerates text-showing operations with
their text matrix and active font state, and
`extractPageContentItems(pageIndex, limits?)` reports page-marking operations
without reading text. Neither provides general visual-text or
image-extraction. See [Find Text Positions](../how-to/find-text-positions.md),
[`tests/PDFTextExtractionTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/PDFTextExtractionTest.js), and [`tests/PDFParser.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/PDFParser.js) for verified usage.
