# Place And Transform Images

Register JPEG, PNG, or TIFF browser bytes before placing the image, or PDF
bytes to place one of their pages. Recipe can fit, align, rotate, skew, frame,
and apply opacity without exposing a filesystem path.

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
await Recipe.registerImageAsync("photo", imageFile, "jpeg");
var pdf = new Recipe(inputBytes);

var outputBytes = pdf
  .editPage(1)
  .image("photo", 300, 220, {
    width: 300,
    height: 300,
    align: "center center",
    keepAspectRatio: true,
    opacity: 0.6,
    rotation: 45,
    rotationOrigin: [300, 220],
    skewY: 10,
  })
  .endPage()
  .endPDF();

Recipe.unregisterImage("photo");
```

Pass the validated extension explicitly: `jpeg`, `jpg`, `png`, `tif`, or
`tiff`. Use `keepAspectRatio: false` only when deliberate stretching is wanted.
See [Byte Assets and Blob Input](../byte-assets.md) for synchronous and async
registration rules.

## Place A PDF Page

A name registered with `registerPdf()` or `registerPdfAsync()` places one page
of that PDF, sized by its media box and fitted, aligned, and transformed like
any other image. `page` selects the page and is one-based, as in `overlay()`.

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
await Recipe.registerPdfAsync("source", pdfFile);

var outputBytes = new Recipe()
  .createPage(595, 842)
  .image("source", 72, 72, {
    page: 2,
    width: 200,
    fill: "#f1f5f9",
    stroke: "#102a43",
    lineWidth: 2,
    dash: [4, 2],
  })
  .endPage()
  .endPDF();

Recipe.unregisterPdf("source");
```

A page is placed as it is displayed: a page with a `/Rotate` entry is turned
and sized accordingly, and a media box that does not start at 0,0 still fills
the image box. `scale` wins over `width` and `height`. Placing the same page
again reuses one form XObject. A `page` past the last page throws `Unknown image`. A name
registered as both an image and a PDF places the image.

## Frame An Image

`fill`, `stroke`, or `color` frame the drawn image box with the image's
rotation and skew: the fill beneath the image, the outline above it. The
outline lies inside the box, as a `rectangle()` stroke does, and uses
`lineWidth`, `dash`, `dashPhase`, `lineCap`, `lineJoin`, and `miterLimit`.
`width` stays the image width. `opacity` applies to the frame as well. Without
`fill`, `stroke`, or `color`, no frame is drawn.

`debug: true` outlines the image box in green and marks the placement point in
red, which helps when checking `align` and `rotationOrigin`.
