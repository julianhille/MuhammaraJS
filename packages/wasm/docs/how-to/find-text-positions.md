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
become U+FFFD, as do codes of fonts whose built-in encoding cannot be read, the
Symbol and ZapfDingbats standard fonts, embedded Type 1 fonts without
`/Encoding`, and Type 3 fonts, unless `/ToUnicode` or `/Differences` maps them,
and every byte of text shown without a font or with a font that cannot be
resolved or read. `content` keeps the raw character codes, for example two-byte
glyph IDs for text written with a composite font. A phrase split across
operations does not match as a whole. The extractor does not calculate glyph
bounds or glyph-driven matrix advances, or descend into Form XObjects such as
appended content created by `Recipe.editPage()`. Adjacent text-showing
operations without an explicit positioning operator retain the same matrix. This
is not a general visual full-text search or glyph-bounds API.

The browser example's **Find text** tab runs this search on an uploaded PDF, or
on a built-in sample when none is chosen, and highlights each match. It
estimates match widths with Recipe's bundled font, so highlights are exact for
the sample and approximate for PDFs that use other fonts.

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

Independent of `limits`, an extraction reads at most 64 MiB of a page's decoded
content, inline image data included, and throws the same error past it. A
compressed content stream can expand far beyond its file size, so this bounds
the work one small PDF can cause.

Decoding `text` also reads the page's fonts. The PDF objects it reads count
against `maxParsedObjects` on their own, and exceeding it throws the same error.
Fonts are cached per reader, but each call still counts a cached font's objects
and CMap bytes, so results never depend on earlier calls. A `/ToUnicode` CMap
larger than 4 MiB, or beyond 32 MiB of CMaps in one call, is ignored and that
font decodes through its `/Encoding` instead. A font that cannot be read decodes
to U+FFFD rather than failing the call. When you only need positions or raw
`content`, pass `{ decodeText: false }` as the third argument to skip reading
fonts; the elements then have no `text`.

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
