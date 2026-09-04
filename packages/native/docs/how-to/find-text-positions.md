# Find Text Positions In A PDF

Use `PDFReader.extractPageText(pageIndex, limits?)` to enumerate text-showing
operations on a page, then filter their `content`. Pages are zero-based and
positions use the low-level PDF bottom-left coordinate system.

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
visual-text search API. See the `PDFTextElement` declaration and [`tests/PDFTextExtractionTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/PDFTextExtractionTest.js)
for the verified output shape.

## Bound the work on untrusted input

Both extractors accept an optional `limits` object. Fields you omit keep the
built-in default, and values above it are clamped down, so a caller can tighten
the budget but never raise it past the ceiling:

```javascript
var elements = reader.extractPageText(0, {
  maxElements: 500,
  maxTextBytes: 64 * 1024,
});
```

| Field              | Default and ceiling |
| ------------------ | ------------------- |
| `maxElements`      | 100000              |
| `maxOperands`      | 1024                |
| `maxTextBytes`     | 16777216 (16 MiB)   |
| `maxParsedObjects` | 1000000             |

A page that exceeds the budget throws rather than returning partial results.

## Detect page marks without reading text

`PDFReader.extractPageContentItems(pageIndex, limits?)` reports every direct
content-stream operation that puts a mark on the page, which is a cheaper way to
answer "is this page blank?" than extracting text:

```javascript
var isBlank = reader.extractPageContentItems(0).length === 0;
```

Each item is `{ type, operation }`, where `type` is one of
`ePDFPageContentItemText`, `ePDFPageContentItemPath`,
`ePDFPageContentItemXObject`, or `ePDFPageContentItemShading`, and `operation`
is the PDF operator that produced it. Text drawn in an invisible rendering mode
(`Tr 3` or `Tr 7`) is excluded; white-on-white text is included, because it is
still a page mark. `limits.maxTextBytes` is accepted for signature parity with
`extractPageText` but has no effect here. See
[`tests/PDFPageContentItemsTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/PDFPageContentItemsTest.js)
for the verified output shape.
