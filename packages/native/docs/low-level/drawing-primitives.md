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
stroked path. `type: "clip"` intersects the current clipping region with the
shape without painting it. It emits `W n`, ending the path so subsequent drawing
does not accidentally reuse its geometry. `close: true` also closes the path.
Use `q()` before defining the clip and `Q()` after the drawing it should affect;
clipping persists until the graphics state is restored. Any other `type`,
such as the typo `"fil"`, throws a `TypeError` before anything is drawn; an
explicit `undefined` counts as omitted and strokes.

An explicit `type: null` ends the path with `n` without painting or clipping,
ignores `width` and `close`, and applies a supplied `color` only to the
non-stroking graphics state. Omit `type` or use `"stroke"` for an outline;
`null` does not select the default.

`DrawingPathType` names these values at runtime and in the TypeScript
declarations, so a misspelled paint mode fails to compile instead of producing
unpainted geometry.
The runtime still tolerates any other value for compatibility, but it is not a
supported input.

Coordinates and drawing options are read and converted before emitting any
operators. A throwing getter or numeric conversion leaves this call's geometry
and graphics-state output unwritten and propagates the original exception.
This applies to page and form contexts on new and modifying writers.

Coordinates, dimensions, stroke widths, and `writeText()` font sizes must
convert to finite numbers. Circle control points and underline endpoints must
also remain finite after calculation. `drawPath()` requires at least two
complete coordinate pairs; malformed or extra arguments throw before drawing.
Correct the input and retry on the same context.

For transformations or operators not covered by these helpers, use the
[PDF operators](pdf-operators.md) interface.

## Named Values

`DrawingPathType`, `ImageFit`, `ObjectReplacementScope`, `DeviceColorSpace`,
`PageBox`, `PDFImageType`, and `EEncoding` are frozen objects of accepted option
strings, for example `DrawingPathType.FILL` or `ImageFit.OVERFLOW`;
`LineCapStyle` and `ETokenSeparator` name numeric operands. `@muhammara/native`
and `@muhammara/wasm` export them with the same names and members, each with a
same-named TypeScript type. The plain values stay accepted.
