# Breaking Changes

## Version 1.x

- Recipe `circle()`, `ellipse()`, `rectangle()`, `arc()`, and `pie()` strokes
  now remain inside positive requested bounds large enough to contain the line
  width, matching native. They previously extended outward by half the line
  width. Most layouts need no change; callers that intentionally relied on the
  overshoot can preserve it by separating the fill and stroke and expanding only
  the stroke geometry. See
  [Migrate Vector Stroke Bounds](migrate-vector-stroke-bounds.md)
  [#743](https://github.com/julianhille/MuhammaraJS/issues/743).

- `PDFRStreamForBuffer#read()`, and the `ByteReader` and
  `ByteReaderWithPosition` adapters built on it, now return a `Uint8Array`
  instead of an array of numbers, matching native, where the same streams return
  a `Buffer`. Code that calls array methods such as `concat`, `push`, or
  `splice` on the result, or compares it with a plain array, now misbehaves or
  throws, and TypeScript code typing the result as `number[]` fails to compile.
  Use typed-array operations, or `Array.from(bytes)` where an array is required
  [#324](https://github.com/julianhille/MuhammaraJS/issues/324).

- `appendPDFPagesFromPDF()` now ends its writer or modifier when appending
  fails. Previously callers could continue and produce a corrupted document;
  create a fresh writer and retry with valid source bytes.

- Merge callbacks now receive `globalThis` as `this`, matching native, instead
  of `undefined` in strict functions. Code relying on an undefined receiver
  should pass `callback.bind(undefined)` explicitly.

- Low-level shape `type: null` now ends the path without painting, matching
  native, instead of drawing an outline using the previous stroke color and
  width. Omit `type` or pass `"stroke"` if you want an outline. See
  [Drawing Helpers And Clipping](low-level.md#drawing-helpers-and-clipping).
- Low-level `drawPath`, `drawCircle`, `drawSquare`, and `drawRectangle` now honor
  `type: "clip"` instead of stroking that path. They emit `W n`, which clips
  without painting and ends the path. Pass `"stroke"` if you intended the old
  painted outline, or scope intentional clipping with `q()`/`Q()`. Unknown
  types end the path without painting; pass `"stroke"`, `"fill"`, or `"clip"` explicitly.
  See [Drawing Helpers And Clipping](low-level.md#drawing-helpers-and-clipping).
- Shape helpers and `writeText()` snapshot options before drawing. A throwing
  option getter no longer leaves partial geometry, text, or graphics-state
  output. Correct the input and retry instead of relying on partial output.
  Option getters should return stable values; Wasm reads text option fields
  once per call.
  Circle and underline calculations that overflow now throw before output.
  Sparse paths and incomplete or extra modified-form `drawPath()` arguments
  also throw instead of drawing partial geometry. Reduce overflowing values
  and supply at least two complete finite coordinate pairs before retrying.
