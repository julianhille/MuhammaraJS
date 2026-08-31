# Find Text Positions In A PDF

Use `PDFReader.extractPageText(pageIndex)` to enumerate text-showing operations,
then filter their content. Reader pages are zero-based and positions use PDF's
bottom-left coordinate system.

```javascript
import { createMuhammaraWasm } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
var reader = await muhammara.createReaderAsync(pdfFile);
var target = "Text to locate";

try {
  var positions = reader
    .extractPageText(0)
    .filter(function (element) {
      return element.content === target;
    })
    .map(function (element) {
      return {
        x: element.textMatrix[4],
        y: element.textMatrix[5],
        fontSize: element.fontSize,
        fontResource: element.fontResource,
      };
    });
} finally {
  reader.end();
}
```

Each result is a PDF text-showing operation in content-stream order.
`textMatrix` is `[a, b, c, d, e, f]`; `e` and `f` are its position. Content is
raw PDF string data and is not decoded through every font character map, so this
is not a general visual full-text search or glyph-bounds API.
