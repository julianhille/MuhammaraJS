# Draw Primitives

Page content contexts provide helpers for rectangles, squares, circles, and
paths. Each accepts drawing options such as `type`, `colorspace`, `color`, and
stroke `width`.

```javascript
var context = pdfWriter.startPageContentContext(page);

context
  .drawRectangle(72, 72, 200, 100, { type: "stroke", color: 0x000000 })
  .drawCircle(172, 300, 50, { type: "fill", color: 0x336699 });
```

Use `drawPath` for a sequence of coordinate pairs. Set `close: true` to close a
stroked path. For transformations, clipping, or operators not covered by these
helpers, use the [PDF operators](pdf-operators.md) interface.

See [`tests/HighLevelContentContext.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/HighLevelContentContext.js) for exercised primitive options.
