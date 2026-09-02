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

Use `moveTo` and `lineTo` for connected paths, `line` and `polygon` for point
arrays, and `circle`, `rectangle`, `ellipse`, `arc`, `n_gon`, `star`,
`triangle`, and `arrow` for shapes. Shape options support fill, stroke, opacity,
rotation, rotation origin, skew, dash, and line properties. See
`tests/recipe/coloring.js`, `tests/recipe/vector.js`, `tests/recipe/arcs.js`,
and `tests/recipe/shapes.js`.
