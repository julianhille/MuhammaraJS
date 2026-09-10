# Read PDFs

Create a reader for a file or compatible input stream, inspect it, and release
its resources when finished.

```javascript
var muhammara = require("@muhammara/native");
var reader = muhammara.createReader("input.pdf");

console.log(reader.getPagesCount());

reader.end();
```

For an encrypted input, provide its user or owner password when creating the
reader:

```javascript
var reader = muhammara.createReader("encrypted.pdf", {
  password: "open-password",
});
```

See [Change PDF Passwords](../how-to/change-pdf-passwords.md) to create,
re-encrypt, or remove encryption.

Call `end()` when the reader is no longer needed, after every object and stream
parsed from it has been consumed. It closes the underlying file handle; skipping
it leaves `input.pdf` locked on Windows, where the file then cannot be deleted
or renamed. `Recipe` releases the readers it opens itself, in `endPDF()`.

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
