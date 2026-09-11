# High-Level Recipe

`createRecipe()` loads the high-level, chainable API for creating and modifying
PDFs from bytes. Recipe runs in browser pages, module Workers, and Node.js, uses
a top-left coordinate origin, and returns an owned `Uint8Array` from `endPDF()`.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var pdfBytes = new Recipe()
  .createPage("A4")
  .text("Hello from Recipe", 72, 72, { size: 24 })
  .endPage()
  .endPDF();

var pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
```

Recipe bundles Roboto Regular, so this example needs no font upload. Registered
fonts, images, and source PDFs are also byte-backed; filesystem paths and Node
streams are not accepted.

## Topics

- [Create PDFs](create-pdfs.md)
- [Pages And Positioning](pages-and-positioning.md)
- [Text And Fonts](text-and-fonts.md)
- [Colors, Shapes, And Vectors](colors-shapes-and-vectors.md)
- [Compose PDFs](compose-pdfs.md)
- [Modify And Inspect PDFs](modify-and-inspect.md)
- [Metadata And Custom Data](metadata-and-custom-data.md)
- [Recipe API Invariants](invariants.md)
- [Encrypt PDFs](encryption.md)

## Task-Oriented Guides

- [Add Review Annotations](../how-to/add-review-annotations.md)
- [Create Multi-Page Tables](../how-to/create-tables.md)
- [Create A Pie Chart](../how-to/create-pie-charts.md)
- [Flow Text Into Columns](../how-to/flow-text-into-columns.md)
- [Watermark Every Page](../how-to/watermark-pdfs.md)
- [Add Clickable URL Links](../how-to/add-url-links.md)
- [Add Content To Rotated Pages](../how-to/add-content-to-rotated-pages.md)
- [Change PDF Passwords](../how-to/change-pdf-passwords.md)
- [Place And Transform Images](../how-to/place-and-transform-images.md)

Use the [generated API reference](../reference.md) for complete method and option
signatures. Review [Differences And Restrictions](../differences.md) before
porting native Recipe code.
