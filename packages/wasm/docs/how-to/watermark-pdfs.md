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
