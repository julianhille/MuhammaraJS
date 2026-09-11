# Colors, Shapes, And Vectors

Recipe accepts hexadecimal colors, RGB component arrays, percentages, and
names registered with `chroma()`. Shape and line options can set fill, stroke,
opacity, transforms, dashes, and line properties.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var pdfBytes = new Recipe()
  .createPage(420, 300)
  .chroma("brandBlue", "#0066cc")
  .rectangle(36, 36, 150, 72, {
    fill: "brandBlue",
    stroke: "#0f172a",
    borderRadius: [12, 12, 4, 4],
  })
  .ellipse(280, 72, 62, 36, { fill: [240, 90, 80], opacity: 0.75 })
  .lineStyle({ width: 3, cap: 1, join: 1, dash: [8, 4] })
  .line([
    [36, 154],
    [190, 210],
    [350, 154],
  ])
  .star(210, 238, 36, 5, { fill: "#fbbf24", stroke: "#92400e" })
  .endPage()
  .endPDF();
```

Use `moveTo()` and `lineTo()` for connected paths. Calls without options only
append path segments; pass painting options to the final `lineTo()` to render
the path. The compatibility methods `fill()`, `stroke()`, and
`fillAndStroke()` do not paint a pending path. Use `line()` and `polygon()` for
point arrays, and `circle()`, `rectangle()`, `ellipse()`, `arc()`, `pie()`,
`n_gon()`, `star()`, `triangle()`, and `arrow()` for common geometry. `pie()`
closes its arc at the center so it can be filled as a wedge.

`lineStyle()` changes subsequent strokes on the current page. It accepts
`width` (or `lineWidth`), numeric PDF `cap` and `join` values, `miterLimit`,
`dash`, and `dashPhase`; omitted values keep their existing setting.
`lineWidth(width)` remains shorthand for `lineStyle({ width })`.

`opacity(value)` sets both fill and stroke alpha for subsequent drawing and
must be between `0` and `1`. Call `opacity(1)` to restore opaque output. A
shape's `opacity` option is scoped to that operation. On new pages, a text run's
`opacity` option also updates the default used by subsequent vector drawing;
the text option is ignored while editing an existing page.

Wasm does not support native Recipe's `chroma("!load", path)` filesystem loader
or Recipe-created Separation colors. Register colors individually and use the
byte-safe low-level resource API when a Separation color space is required.

See [Create A Pie Chart](../how-to/create-pie-charts.md) for a complete chart and
the [API reference](../reference.md) for shape-specific options.
