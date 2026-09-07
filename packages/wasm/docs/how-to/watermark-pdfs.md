# Watermark Every Page

Read the page count from the byte-backed reader, then edit each one-based Recipe
page and draw semi-transparent centered text.

```javascript
import { createMuhammaraWasm, createRecipe } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
var reader = muhammara.createReader(inputBytes);
var pageCount = reader.getPagesCount();
reader.end();

var Recipe = await createRecipe();
await Recipe.registerFontAsync("watermark-font", fontFile);
var pdf = new Recipe(inputBytes);

for (var pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
  var page = pdf.pageInfo(pageNumber);
  pdf
    .editPage(pageNumber)
    .text("WATERMARK", page.width / 2, page.height / 2, {
      font: "watermark-font",
      fontSize: 60,
      color: "#0000ff",
      align: "center center",
      opacity: 0.3,
    })
    .endPage();
}

var outputBytes = pdf.endPDF();
Recipe.unregisterFont("watermark-font");
```

The reader uses zero-based page indexes for page operations, while Recipe
editing uses one-based page numbers. `pageInfo()` accounts for rotated page
dimensions before the watermark center is calculated.

## Watermark In Place

The WebAssembly package is byte-first, so there is no second file to avoid:
`endPDF()` returns the finished document and the source bytes stay untouched.
"In place" means replacing whatever held the input with the returned bytes.

```javascript
var pdf = new Recipe(inputBytes);

for (var pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
  var page = pdf.pageInfo(pageNumber);
  pdf
    .editPage(pageNumber)
    .text("WATERMARK", page.width / 2, page.height / 2, {
      font: "watermark-font",
      fontSize: 60,
      align: "center center",
      opacity: 0.3,
    })
    .endPage();
}

inputBytes = pdf.endPDF();
```

The result is a separate `Uint8Array`; the input is never modified, so both
documents are briefly in memory. Drop your reference to the source, as above,
when only the watermarked bytes are needed.

Editing an existing document appends an incremental update rather than rewriting
it, so feeding the output back in as the next input grows the document each
round. Watermark once from the original when size matters.

In Node, write the bytes back over the file the input came from:

```javascript
await writeFile("input.pdf", pdf.endPDF());
```

In the browser, hand them to a download or upload as described in
[Preview, Download, or Upload a PDF](serve-a-pdf-response.md). The native package
can instead overwrite the source file directly by omitting the Recipe output
path; see [Differences and Restrictions](../differences.md).
