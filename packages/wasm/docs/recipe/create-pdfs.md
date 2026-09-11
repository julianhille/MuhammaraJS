# Create PDFs With Recipe

Load `Recipe` asynchronously, create each page, and call `endPDF()` after the
last page. The finished PDF is an owned `Uint8Array` suitable for a `Blob`, a
request body, browser storage, or any other byte consumer.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var recipe = new Recipe({
  version: 1.7,
  author: "Example Co.",
  title: "Quarterly summary",
});

var pdfBytes = recipe
  .createPage("letter")
  .text("Quarterly summary", 54, 54, { size: 24, color: "#17324d" })
  .rectangle(54, 96, 504, 80, {
    fill: "#e8f1f8",
    stroke: "#7ca4c4",
  })
  .text("Created entirely in memory.", 72, 130)
  .endPage()
  .endPDF();

var response = new Response(pdfBytes, {
  headers: { "content-type": "application/pdf" },
});
```

Named sizes include `letter` and `A4`; `createPage(width, height)` accepts
explicit point dimensions. Call `endPage()` before creating or editing another
page. Repeated `endPDF()` calls return the same cached byte array. Call
`recipe.dispose()` when a long-lived application no longer needs the Recipe's
WebAssembly allocations.

## PDF Version

`version` accepts decimal PDF levels `1.0` through `1.7` and `2.0`, plus Wasm's
integer version enums `10` through `17` and `20`. Unsupported values fall back
to `1.7` without throwing. The integer values are exposed as the
`ePDFVersion*` constants on a loaded low-level runtime.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var pdfBytes = new Recipe({ version: 2.0 })
  .createPage(320, 180)
  .text("PDF 2.0 header", 24, 36)
  .endPage()
  .endPDF();

console.log(new TextDecoder().decode(pdfBytes.slice(0, 8))); // %PDF-2.0
```

The integer forms and byte-returning output are Wasm-specific conveniences.
Native Recipe writes to a path or returns a `Buffer` through a callback instead.
