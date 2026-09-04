# Find Text Positions In A PDF

Use `PDFReader.extractPageText(pageIndex)` to enumerate text-showing operations
on a page, then filter their `content`. Pages are zero-based and positions use
the low-level PDF bottom-left coordinate system.

```javascript
var muhammara = require("@muhammara/native");
var reader = muhammara.createReader("input.pdf");
var text = "Add some texts to an existing pdf file";

var matches = reader.extractPageText(0).filter(function (element) {
  return element.content === text;
});

var positions = matches.map(function (element) {
  return {
    x: element.textMatrix[4],
    y: element.textMatrix[5],
    fontSize: element.fontSize,
    fontResource: element.fontResource,
  };
});
```

Each result represents a PDF text-showing operation in content-stream drawing
order. `textMatrix` is `[a, b, c, d, e, f]`; `e` and `f` are the text position.
Repeated text produces multiple matches, so use the matrix, font resource, and
surrounding operations to choose the intended occurrence.

`content` contains raw character codes from the PDF content stream. The API does
not decode font character maps or calculate glyph bounds, so it is not a general
visual-text search API. Extraction rejects pages over its documented safety
limits. See the `PDFTextElement` declaration and [`tests/PDFTextExtractionTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/PDFTextExtractionTest.js)
for the verified output shape.
