# Find Text Positions In A PDF

Use `PDFReader.extractPageText(pageIndex)` to enumerate text-showing operations,
then filter their decoded `text`. Reader pages are zero-based and positions use
PDF's bottom-left coordinate system.

```javascript
import { createMuhammaraWasm } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
var reader = await muhammara.createReaderAsync(pdfFile);
var target = "Text to locate";

try {
  var positions = reader
    .extractPageText(0)
    .filter(function (element) {
      return element.text === target;
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

Each result is a PDF text-showing operation in direct content-stream order.
`textMatrix` is `[a, b, c, d, e, f]`; `e` and `f` are its origin in page
coordinates. The matrix combines explicit text positioning through `BT`, `Tm`,
`Td`, `TD`, `TL`, `T*`, `'`, and `"` with the active graphics transformation
from `cm`; its first four values retain rotation, scale, or skew. `text` is the
string decoded through the active font: the font's `/ToUnicode` CMap first, then
a simple font's `/Encoding` and `/Differences`; codes the font does not map
become U+FFFD. `content` keeps the raw character codes, for example two-byte
glyph IDs for text written with a composite font. A phrase split across
operations does not match as a whole. The extractor does not calculate glyph
bounds or glyph-driven matrix advances, or descend into Form
XObjects such as appended content created by `Recipe.editPage()`. Adjacent
text-showing operations without an explicit positioning operator retain the
same matrix. This is not a general visual full-text search or glyph-bounds API.

## Bound the work on untrusted input

Both extractors accept an optional `limits` object. Fields you omit keep the
built-in default, and values above it are clamped down, so a caller can tighten
the budget but never raise it past the ceiling:

```javascript
var reader = await muhammara.createReaderAsync(pdfFile);
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
var reader = await muhammara.createReaderAsync(pdfFile);
var isBlank = reader.extractPageContentItems(0).length === 0;
reader.end();
```

Each item is `{ type, operation }`, where `type` is one of
`ePDFPageContentItemText`, `ePDFPageContentItemPath`,
`ePDFPageContentItemXObject`, or `ePDFPageContentItemShading` — read from the
loaded runtime, as in `muhammara.ePDFPageContentItemPath` — and `operation`
is the PDF operator that produced it. An inline image reports as
`ePDFPageContentItemXObject` with operation `BI`; its binary payload is skipped
rather than parsed, so the bytes cannot invent extra items. Text drawn in an invisible rendering mode
(`Tr 3` or `Tr 7`) is excluded; white-on-white text is included, because it is
still a page mark. `limits.maxTextBytes` is accepted for signature parity with
`extractPageText` but has no effect here.
