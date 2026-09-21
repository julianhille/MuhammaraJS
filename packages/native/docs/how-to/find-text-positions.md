# Find Text Positions In A PDF

Use `PDFReader.extractPageText(pageIndex, limits?)` to enumerate text-showing
operations on a page, then filter their `content`. Pages are zero-based and
positions use the low-level PDF bottom-left coordinate system.

```javascript
var muhammara = require("@muhammara/native");
var reader = muhammara.createReader("input.pdf");
var target = "Text to locate";

try {
  var positions = reader
    .extractPageText(0, { maxTextBytes: 1024 * 1024 })
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

Each result represents a PDF text-showing operation in direct content-stream
drawing order. `textMatrix` is `[a, b, c, d, e, f]`; `e` and `f` are the text
origin in page coordinates. The matrix combines explicit text positioning
through `BT`, `Tm`, `Td`, `TD`, `TL`, `T*`, `'`, and `"` with the active graphics
transformation from `cm`. Its first four values retain rotation, scale, or skew.
Repeated text produces multiple matches, so use the matrix, font resource, and
surrounding operations to choose the intended occurrence.

`content` contains raw character codes from the PDF content stream. The API does
not decode font character maps or calculate glyph bounds, so it is not a general
visual-text search API. It also does not calculate glyph-driven text-matrix
advances, so adjacent text-showing operations without an explicit positioning
operator retain the same matrix. Extraction does not descend into Form XObjects,
including appended forms created by `Recipe.editPage()`.

## Bound the work on untrusted input

Both extractors accept an optional `limits` object. Fields you omit keep the
built-in default, and values above it are clamped down, so a caller can tighten
the budget but never raise it past the ceiling:

```javascript
var reader = muhammara.createReader("input.pdf");
var elements = reader.extractPageText(0, {
  maxElements: 500,
  maxTextBytes: 64 * 1024,
});
reader.end();
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
var muhammara = require("@muhammara/native");
var reader = muhammara.createReader("input.pdf");
var blankPages = [];

try {
  for (var pageIndex = 0; pageIndex < reader.getPagesCount(); ++pageIndex) {
    var items;
    try {
      items = reader.extractPageContentItems(pageIndex, {
        maxElements: 1000,
        maxParsedObjects: 100000,
      });
    } catch (error) {
      if (!/exceeds item extraction limits/.test(error.message)) {
        throw error;
      }
      // A page with more marks than the budget allows is not blank.
      continue;
    }
    if (items.length === 0) {
      blankPages.push(pageIndex);
    }
  }
} finally {
  reader.end();
}
```

Each item is `{ type, operation }`, where `type` is one of
`ePDFPageContentItemText`, `ePDFPageContentItemPath`,
`ePDFPageContentItemXObject`, or `ePDFPageContentItemShading`, and `operation`
is the PDF operator that produced it. An inline image reports as
`ePDFPageContentItemXObject` with operation `BI`; its binary payload is skipped
rather than parsed, so the bytes cannot invent extra items. Text drawn in an invisible rendering mode
(`Tr 3` or `Tr 7`) is excluded; white-on-white text is included, because it is
still a page mark. `limits.maxTextBytes` is accepted for signature parity with
`extractPageText` but has no effect here.
