# Compose PDFs

Register source PDF bytes under a name before appending, inserting, or
overlaying pages. Synchronous registration accepts `Uint8Array` and
`ArrayBuffer`; use `registerPdfAsync()` for `Blob` or `File`.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var sourceBytes = new Recipe()
  .createPage(300, 200)
  .text("Source page one", 36, 48)
  .endPage()
  .createPage(300, 200)
  .text("Source page two", 36, 48)
  .endPage()
  .endPDF();

Recipe.registerPdf("appendix", sourceBytes);
var recipe = new Recipe()
  .createPage(612, 792)
  .text("Cover", 72, 72, { size: 30 })
  .overlay("appendix", 72, 140, { page: 1, scale: 0.75 })
  .endPage()
  .appendPage("appendix", 2)
  .insertPage(0, "appendix", 1);

var pdfBytes = recipe.endPDF();
Recipe.unregisterPdf("appendix");
```

Recipe composition page numbers are one-based. Omit the second `appendPage()`
argument to append every page. A number selects one page; arrays select pages
and nested pairs select inclusive ranges. For example, `[1, 3]` selects pages 1
and 3, while `[[1, 3]]` selects pages 1 through 3.

`insertPage(afterPageNumber, name, sourcePageNumber)` accepts zero as the output
position before page one and defers rebuilding until `endPDF()`. `overlay()`
requires an active created or edited page and supports `page`, `scale`,
`fitWidth`, `fitHeight`, and `keepAspectRatio`.

## Split Into Byte Outputs

`split(prefix)` ends the Recipe and returns one named `Uint8Array` per page. It
does not write an output directory. `Recipe.splitPdf(name, prefix)` provides the
same `[{ name, bytes }]` result directly for a registered PDF.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var parts = new Recipe()
  .createPage(200, 200)
  .endPage()
  .createPage(200, 200)
  .endPage()
  .split("chapter");

for (var part of parts) {
  console.log(part.name, part.bytes.byteLength);
}
```

Appending or rebuilding a source page does not retain its existing `/Annots`
graph. Recipe-created annotations in their own output are preserved. See
[Differences And Restrictions](../differences.md).
