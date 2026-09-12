# Pages And Positioning

High-level drawing uses points measured from the page's top-left corner. Create
a named page or pass explicit width and height; page numbers used by Recipe are
one-based. Named sizes are case-insensitive and include Letter, Legal, A/B/C,
RA, and SRA sizes.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var recipe = new Recipe()
  .createPage("A4", 90, { left: 54, right: 54, top: 72, bottom: 72 })
  .rectangle(0, 0, 100, 100, { stroke: "#64748b" })
  .text("Top-left origin", 12, 28)
  .rotateContent(12, 180, 160)
  .rectangle(180, 160, 140, 48, { fill: "#dbeafe" });

var current = recipe.getCurrentPageInfo();
console.log(current.width, current.height, current.rotate);
var pdfBytes = recipe.endPage().endPDF();
```

The rotation argument to `createPage("A4", 90)` swaps the named page's width
and height. `rotate(degrees)` sets `/Rotate` on the active page, including pages
with explicit dimensions. If both are used, `rotate()` supplies the final
rotation value while the named size remains swapped. Positive
`rotateContent()` angles rotate subsequent content clockwise because Recipe's Y
axis points down. Its optional `x` and `y` values select the Recipe-coordinate
point around which subsequent drawing rotates.

`pageInfo(pageNumber)` returns geometry for a specific one-based page.
`getCurrentPageInfo()` returns geometry for the active or most recently ended
page. Despite its name, `getPageInfo()` is the native-compatible document Info
accessor, not a page-geometry method. Use `info()` to read metadata currently
known to Recipe.

`margins()` returns a copy of the current margins. Pass an object or four
numbers to update margins; omitted sides retain their current values. The
read-only `position` property reports the latest high-level cursor updated by
`moveTo()`, `lineTo()`, and text placement.

## Page Boxes

`setPageBox()` is an intentional exception to Recipe coordinates: its four
values are native PDF coordinates measured from the bottom-left corner.
`rectangle()` can opt into the same coordinate system with
`useGivenCoords: true`. The box constant comes from the loaded low-level
runtime.

```js
import { createMuhammaraWasm, createRecipe } from "@muhammara/wasm";

var [muhammara, Recipe] = await Promise.all([
  createMuhammaraWasm(),
  createRecipe(),
]);
var pdfBytes = new Recipe()
  .createPage(300, 400)
  .setPageBox(muhammara.ePDFPageBoxCropBox, 18, 24, 282, 376)
  .text("Inside the crop box", 36, 48)
  .endPage()
  .endPDF();
```

See [Set Page Boxes](../how-to/set-page-boxes.md) and
[Add Content To Rotated Pages](../how-to/add-content-to-rotated-pages.md) for
complete editing workflows.
