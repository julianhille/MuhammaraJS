# Place And Transform Images

Recipe can center, scale, rotate, skew, and apply opacity to images while
editing an existing PDF.

```javascript
pdfDoc
  .editPage(1)
  .image("photo.jpg", "center", "center", {
    width: 300,
    height: 300,
    align: "center center",
    opacity: 0.6,
  })
  .image("logo.png", "center", 600, {
    scale: 0.1,
    rotation: 45,
    rotationOrigin: [270, 550],
    skewY: 10,
  })
  .endPage()
  .endPDF();
```

Use `keepAspectRatio` when fitting an image to explicit dimensions.

## Place A PDF Page

`image()` also accepts a PDF file. It places one page, sized by its media box
and fitted, aligned, and transformed like any other image. `page` selects the
page and is one-based, as in `overlay()`.

```javascript
var Recipe = require("@muhammara/native").Recipe;

new Recipe("new", "output.pdf")
  .createPage(595, 842)
  .image("source.pdf", 72, 72, {
    page: 2,
    width: 200,
    fill: "#f1f5f9",
    stroke: "#102a43",
    lineWidth: 2,
    dash: [4, 2],
  })
  .endPage()
  .endPDF();
```

A page is placed as it is displayed: a page with a `/Rotate` entry is turned
and sized accordingly, and a media box that does not start at 0,0 still fills
the image box. `scale` wins over `width` and `height`. Placing the same page
again reuses one form XObject. A `page` past the last page throws `Unknown image`.

## Frame An Image

`fill`, `stroke`, or `color` frame the drawn image box with the image's
rotation and skew: the fill beneath the image, the outline above it. The
outline lies inside the box, as a `rectangle()` stroke does, and uses
`lineWidth`, `dash`, `dashPhase`, `lineCap`, `lineJoin`, and `miterLimit`.
`width` stays the image width. `opacity` applies to the frame as well. Without
`fill`, `stroke`, or `color`, no frame is drawn.

`debug: true` outlines the image box in green and marks the placement point in
red, which helps when checking `align` and `rotationOrigin`.
