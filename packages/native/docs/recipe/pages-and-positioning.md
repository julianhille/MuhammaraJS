# Pages And Positioning

Recipe uses a top-left coordinate origin. Create a named page size or provide
width and height directly, then call `endPage()` before switching pages.

```javascript
pdfDoc
  .createPage("A4", 90, { left: 54, right: 54, top: 72, bottom: 72 })
  .rectangle(0, 0, 100, 100, { stroke: "#cccccc" })
  .endPage();
```

The second argument for a named page is rotation. A 90- or 270-degree rotation
swaps its width and height. `rotate(degrees)` sets the PDF `/Rotate` value on
the current page, including a page created with an explicit width and height.
When both are used on a named page, `rotate()` is the last rotation setting and
wins; the named size's swapped dimensions remain unchanged. `pageInfo(pageNumber)`
returns page geometry for a specific one-based page. Inside a `createPage()` or
`editPage()` block, `getCurrentPageInfo()` returns that same geometry for the
active page, including after `endPage()`. Despite its similar name,
`getPageInfo()` returns document Info metadata, not page geometry. Rectangles
use a top-left anchor; circles and ellipses use center coordinates.
`rotationOrigin` selects the point used for transformations.

`rotateContent(degrees, x, y)` rotates subsequent drawing around a point in
Recipe's top-left coordinates.

See [`tests/recipe/create.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/create.js), [`tests/recipe/positioning.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/positioning.js), and
[`tests/recipe/rotation.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/rotation.js).
