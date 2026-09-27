# Breaking Changes

## Version 1.x

- Recipe `n_gon()` and `star()` throw
  `RangeError: n_gon sides must be a finite number no greater than 100000`
  (`star points …` for `star()`) when the side or point count is `NaN`,
  `Infinity`, not a number, or above 100000. An infinite or huge count used to
  build vertices until memory ran out, and `NaN`
  drew nothing. Pass a finite count; beyond a few hundred sides a polygon is
  indistinguishable from `circle()`
  [#821](https://github.com/julianhille/MuhammaraJS/issues/821)

- Recipe `annot(x, y, subtype, { width, height })` places its rectangle with
  (x, y) as the top-left corner, as documented and as native does, like
  `rectangle()` and `link()`. Earlier 1.0.0 prereleases used (x, y) as the
  bottom-left corner, so an annotation with a `height` now appears `height`
  points lower, and Highlight, Underline, StrikeOut, and Squiggly render where
  native draws them. Subtract `height` from `y` to keep the previous position.
  `comment()` and the markup options of `text()` are unchanged [#808](https://github.com/julianhille/MuhammaraJS/issues/808).

- The low-level drawing helpers and `writeText()` throw
  `TypeError: only a numeric color can use the gray or cmyk colorspace` for a
  color name, `#rrggbb` string, or `[r, g, b]` array with `colorspace: "gray"`
  or `"cmyk"`, matching native. Such a color is RGB, but it was read as gray or
  CMYK, so `{ color: "red", colorspace: "gray" }` drew black. Drop `colorspace`
  for an RGB color, or pass the gray or CMYK color as a number; see
  [Draw in Gray and CMYK](how-to/draw-in-gray-and-cmyk.md)
  [#799](https://github.com/julianhille/MuhammaraJS/issues/799).

- A hex color string without the leading `#`, such as `"ff0000"`, and an empty
  color string throw
  `TypeError: Colors must be a 24-bit number, a color name, or a #rrggbb string`
  in the low-level drawing helpers, `writeText()`, and `CompactModifier` shapes
  and text, matching native. Previously `"ff0000"` drew red and `""` drew
  black. Write `"#ff0000"`, or pass a 24-bit number such as `0xff0000`
  [#796](https://github.com/julianhille/MuhammaraJS/issues/796).

- Recipe `annot()` and `comment()`, and the `underline`, `strikeOut`, and
  `highlight` annotations of `text()`, resolve `color` like native: `#rrggbb`,
  `%r,g,b`, colors registered with `chroma()`, then CSS color names in any
  case. Anything else throws `TypeError: Unknown annotation color (<value>)`,
  including hex without the `#` and numbers, which used to be accepted.
  `"green"` now writes the Recipe color `#00ff00` instead of CSS `#008000`;
  write `"#008000"` to keep the old color [#796](https://github.com/julianhille/MuhammaraJS/issues/796).

- Annotation `color` arrays hold numbers from 0 to 255, matching native.
  Values up to 1 used to be read as fractions, so `[1, 0, 0]` wrote red and now
  writes nearly black. A value outside 0 to 255 throws
  `TypeError: Annotation colors need one, three, or four numbers from 0 to 255`.
  Multiply fractional components by 255, for example `[255, 0, 0]` [#796](https://github.com/julianhille/MuhammaraJS/issues/796).

- Recipe `circle()`, `ellipse()`, `rectangle()`, `arc()`, and `pie()` strokes
  now remain inside positive requested bounds large enough to contain the line
  width, matching native. They previously extended outward by half the line
  width. Most layouts need no change; callers that intentionally relied on the
  overshoot can preserve it by separating the fill and stroke and expanding only
  the stroke geometry. See
  [Migrate Vector Stroke Bounds](migrate-vector-stroke-bounds.md)
  [#743](https://github.com/julianhille/MuhammaraJS/issues/743).

- `PDFRStreamForBuffer#read()`, and the `ByteReader` and
  `ByteReaderWithPosition` adapters built on it, and the byte readers from
  `startReadingFromStream()`, `startReadingFromStreamForPlainCopying()`,
  `getParserStream()`, and `getSourceDocumentStream()` now return a `Uint8Array`
  instead of an array of numbers, matching native, where the same streams return
  a `Buffer`. Code that calls array methods such as `concat`, `push`, or
  `splice` on the result, or compares it with a plain array, now misbehaves or
  throws, and TypeScript code typing the result as `number[]` fails to compile.
  Use typed-array operations, or `Array.from(bytes)` where an array is required
  [#324](https://github.com/julianhille/MuhammaraJS/issues/324).

- `appendPDFPagesFromPDF()` now ends its writer or modifier when copying pages
  fails. Previously callers could continue and produce a corrupted document;
  create a fresh writer and retry with valid source bytes. Source bytes that
  cannot be parsed, encrypted input, and page ranges outside the source still
  throw without ending the writer, because nothing was written
  [#828](https://github.com/julianhille/MuhammaraJS/issues/828).

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
