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
swaps its width and height. Use `pageInfo(pageNumber)` before adding
size-dependent content to an existing page. Rectangles use a top-left anchor;
circles and ellipses use center coordinates. `rotationOrigin` selects the point
used for transformations.

See `tests/recipe/create.js`, `tests/recipe/positioning.js`, and
`tests/recipe/rotation.js`.
