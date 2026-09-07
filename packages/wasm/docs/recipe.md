# Recipe

Load `Recipe` asynchronously. It is the high-level API for byte-backed PDF
creation and editing, and uses top-left coordinates for high-level drawing.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
Recipe.registerFont("inter", fontBytes);
var bytes = new Recipe()
  .createPage(595, 842)
  .text("Hello", 72, 72, { font: "inter", fontSize: 24 })
  .rectangle(72, 110, 120, 24, { fill: "#dbeafe" })
  .endPage()
  .endPDF();
```

Register fonts, images, and source PDFs from bytes. `new Recipe(sourceBytes)`
edits an existing PDF; `read(bytes)` only inspects metadata and does not replace
the Recipe output state. `endPDF()` is idempotent and returns the same cached
`Uint8Array` on subsequent calls.

Recipe provides pages, text, shapes, images, tables, composition, annotations,
metadata, and byte-safe splitting. `setPageBox()` uses PDF bottom-left
coordinates even though the high-level drawing API uses top-left coordinates.

## PDF Version

`version` sets the PDF level written into the byte output. Recipe accepts the
canonical decimal levels `1.0` through `1.7` and `2.0`, and the equivalent
integer enums `10` through `17` and `20` (the `ePDFVersion*` constants on a
loaded runtime). Any other value falls back to `1.7` without an error.

```js
var Recipe = await createRecipe();
var bytes = new Recipe({ version: 2.0 })
  .createPage(595, 842)
  .endPage()
  .endPDF();
// bytes now start with %PDF-2.0; new Recipe({ version: 20 }) is equivalent
```

Read [Differences And Restrictions](differences.md) before relying on HTML,
plugins, encryption, composition annotations, or Node Recipe behavior.

Task-oriented Recipe guides:

- [Add Review Annotations](how-to/add-review-annotations.md)
- [Create Multi-Page Tables](how-to/create-tables.md)
- [Flow Text Into Columns](how-to/flow-text-into-columns.md)
- [Watermark Every Page](how-to/watermark-pdfs.md)
- [Add Clickable URL Links](how-to/add-url-links.md)
- [Add Content To Rotated Pages](how-to/add-content-to-rotated-pages.md)
- [Place And Transform Images](how-to/place-and-transform-images.md)
