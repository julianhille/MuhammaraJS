# Colors, Shapes, And Vectors

Recipe accepts hexadecimal colors, component arrays, percentage colors, and
named colors registered with `chroma`.

```javascript
pdfDoc
  .createPage("letter")
  .chroma("brandBlue", "#0066cc")
  .rectangle(72, 72, 180, 80, {
    fill: "brandBlue",
    stroke: "#000000",
    lineWidth: 1,
  })
  .ellipse(360, 112, 60, 35, { fill: [255, 0, 0] })
  .line(
    [
      [72, 200],
      [250, 200],
    ],
    { stroke: "#008000", lineWidth: 2 },
  )
  .endPage()
  .endPDF();
```

`lineWidth(width)` remains available as a shorthand for
`lineStyle({ width })`.

Use `moveTo` and `lineTo` for connected paths, `line` and `polygon` for point
arrays, and `circle`, `rectangle`, `ellipse`, `arc`, `n_gon`, `star`,
`triangle`, and `arrow` for shapes. Shape options support fill, stroke, opacity,
rotation, rotation origin, skew, dash, and line properties. See
[`tests/recipe/coloring.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/coloring.js), [`tests/recipe/vector.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/vector.js), [`tests/recipe/arcs.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/arcs.js),
and [`tests/recipe/shapes.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/shapes.js).

Use `opacity(value)` to set both fill and stroke alpha for subsequent drawing;
`value` must be a finite number from `0` (transparent) through `1` (opaque).
It remains active for later vector drawing; call `opacity(1)` to restore opaque
output.

Use `lineStyle()` to set the PDF stroke style for subsequent drawing on the
current page context. It accepts `width` (or `lineWidth`), numeric PDF `cap`
and `join` values, `miterLimit`, `dash`, and `dashPhase`. Omitted properties
leave the existing style unchanged:

```javascript
pdfDoc
  .createPage("letter")
  .lineStyle({
    width: 2,
    cap: 1,
    join: 2,
    miterLimit: 5,
    dash: [6, 3],
    dashPhase: 1,
  })
  .line([
    [72, 72],
    [360, 72],
  ])
  .endPage()
  .endPDF();
```
