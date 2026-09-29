# Breaking Changes

This page collects the compatibility changes formerly maintained in the README.

## Version 7.x

- Recipe `n_gon()` and `star()` throw
  `RangeError: n_gon sides must be a finite number no greater than 100000`
  (`star points …` for `star()`) when the side or point count is `NaN`,
  `Infinity`, not a number, or above 100000. An infinite or huge count used to
  build vertices until the process ran out of memory and aborted, and `NaN`
  drew nothing. Pass a finite count; beyond a few hundred sides a polygon is
  indistinguishable from `circle()`
  [#821](https://github.com/julianhille/MuhammaraJS/issues/821)
- `PDFWriter#end()` throws
  `Error: End the active objects context operation before ending the PDF`
  while a dictionary started with `startDictionary()` is still open, as
  `@muhammara/wasm` does. The writer stays usable: end the dictionary and
  call `end()` again. In 6.x `end()` succeeded and wrote the cross-reference
  table and trailer inside the open dictionary, so the PDF was damaged
  [#815](https://github.com/julianhille/MuhammaraJS/issues/815).
- Recipe `register()` throws
  `Found conflict in Recipe prototypes. <name> already exists.` for a plugin
  named like a method new in v7: `deletePage`, `getCurrentPageInfo`,
  `lineStyle`, `link`, `opacity`, `pie`, `removeText`, `replaceText`,
  `rotate`, `rotateContent`, or `setPageBox`. Rename the plugin; see
  [Rename Recipe plugins that collide with new methods](getting-started/migrate-from-v6.md#17-rename-recipe-plugins-that-collide-with-new-methods)
  [#829](https://github.com/julianhille/MuhammaraJS/issues/829).
- Recipe `annot(x, y, subtype, { width, height })` places its rectangle with
  (x, y) as the top-left corner, like `rectangle()` and `link()`. In 6.x (x, y)
  was the bottom-left corner, so a Square, Circle, FreeText, or other
  annotation with a `height` now appears `height` points lower on the page.
  Subtract `height` from `y` to keep the 6.x position; see [Move Recipe
  annotations to their top-left
  corner](getting-started/migrate-from-v6.md#16-move-recipe-annotations-to-their-top-left-corner).
  Highlight, Underline, StrikeOut, and Squiggly created with `annot()` already
  hung down from `y` and render where they did, but their `Rect` now encloses
  their `QuadPoints` instead of lying above them. `comment()` without `width`
  and `height`, which 6.x ignored, and the markup options of `text()` are
  unchanged [#808](https://github.com/julianhille/MuhammaraJS/issues/808).
- Low-level `drawPath()`, `drawCircle()`, `drawSquare()`, `drawRectangle()`,
  and `writeText()` throw
  `TypeError: Colors must be a 24-bit number, a color name, or a #rrggbb string`
  when a string `color` is neither a CSS color name nor `#rrggbb`, such as a
  misspelled name or hex without the `#`. In 6.x those colors were drawn black,
  and so was every `#rrggbb` string. Pass a CSS color name, a `#rrggbb` string,
  or a 24-bit number such as `0xff0000` [#796](https://github.com/julianhille/MuhammaraJS/issues/796).
- Recipe `annot()` and `comment()`, and the `underline`, `strikeOut`, and
  `highlight` annotations of `text()`, throw
  `TypeError: Unknown annotation color (<value>)` when `color` is not a known
  color. In 6.x an unknown color, such as a misspelled name, silently wrote the
  default color. Known colors are `#rrggbb`, `%r,g,b`, colors registered with
  `chroma()`, and CSS color names in any case; a CSS name such as `"navy"` now
  writes that color instead of the default. Gray `#rr` and CMYK `#ccmmyykk`
  throw as well, and numbers, which failed with an internal error in 6.x, now
  throw this `TypeError`. `text()` checks its markup annotations before drawing any
  text. Fix the name, or register it with `chroma()` first [#796](https://github.com/julianhille/MuhammaraJS/issues/796).
- Colors registered with Recipe `chroma()` belong to the Recipe that registered
  them, as in `@muhammara/wasm`. In 6.x every Recipe in the process shared one
  color table, so a name registered on one Recipe also resolved in every other
  Recipe. In another Recipe the name is now unknown: text and shape colors
  fall back to the default color, and annotation colors throw
  `TypeError: Unknown annotation color (<name>)`. Register the color with
  `chroma()` on each Recipe that uses it [#799](https://github.com/julianhille/MuhammaraJS/issues/799).
- An annotation `color` array with one number is written as a gray, and one
  with four numbers as a CMYK annotation color. In 6.x both were misread as
  RGB, so `[128]` wrote dark blue and CMYK arrays lost a channel. An array with
  another length, or a value outside 0 to 255, throws
  `TypeError: Annotation colors need one, three, or four numbers from 0 to 255`.
  Pass one, three, or four numbers from 0 to 255; three-number arrays are
  unchanged [#796](https://github.com/julianhille/MuhammaraJS/issues/796).
- Recipe `line()` strokes all of its points as one path, as in
  `@muhammara/wasm`; 6.x stroked every segment as its own path. Segments now
  meet at the `lineJoin` instead of overlapping their caps, so corners drawn
  with `butt` caps are closed and a translucent line no longer darkens where
  segments overlap. A Separation line writes one form XObject instead of one
  per segment. To keep separate segments, draw each with its own `moveTo()`
  and `lineTo()`
  [#799](https://github.com/julianhille/MuhammaraJS/issues/799).
- An unknown colorspace throws a `TypeError`, as in `@muhammara/wasm`. The
  low-level drawing and `writeText()` color options throw
  `TypeError: colorspace must be rgb, gray, or cmyk` for a numeric or named
  `color`; in 6.x a numeric color drew without setting a color and a named
  color ignored the colorspace. Recipe `chroma()`, text and drawing options throw
  `TypeError: Unknown colorspace: <name>`; in 6.x `chroma()` threw a plain
  `Error` and a named color in an unknown colorspace failed with
  `Cannot read properties of undefined`. The declaration of
  `ColorOptions.colorspace` no longer accepts any `string`, so `tsc` reports a
  value typed `string`. Pass a
  `DeviceColorSpace` value; see
  [Type Colorspaces](getting-started/migrate-from-v6.md#type-colorspaces) [#799](https://github.com/julianhille/MuhammaraJS/issues/799).
- The low-level drawing helpers and `writeText()` throw
  `TypeError: only a numeric color can use the gray or cmyk colorspace` for a
  color name or `#rrggbb` string with `colorspace: "gray"` or `"cmyk"`, as in
  `@muhammara/wasm`. Such a color is RGB; in 6.x it drew in RGB and the
  colorspace was ignored. Drop `colorspace` for a string color, or pass the
  gray or CMYK color as a number; see
  [Draw in Gray and CMYK](how-to/draw-in-gray-and-cmyk.md) [#799](https://github.com/julianhille/MuhammaraJS/issues/799).
- `InfoDictionary#getAdditionalInfoEntries()` is declared without its ignored
  `key` parameter, so `getAdditionalInfoEntries("Company")` fails `tsc` with
  `Expected 0 arguments`. The call always returned every entry; drop the
  argument and read the key from the result. The call also works without an
  argument now; 6.x threw unless it got one [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792).
- `DocumentCopyingContext#getSourceDocumentParser()` is declared without the
  `input` and `options` parameters that its runtime never used, so
  `getSourceDocumentParser("source.pdf")` fails `tsc` with
  `Expected 0 arguments`. The call always returned the parser of the copying
  context's source document; drop the arguments [#320](https://github.com/julianhille/MuhammaraJS/issues/320).
- `WriteTextOptions` no longer declares `strikeOut` and `lineWidth`, which
  `writeText()` never read. Passing them fails `tsc` with an excess-property
  error; remove them, draw the line with `drawPath()`, or use the Recipe
  `text()` `strikeOut` option [#799](https://github.com/julianhille/MuhammaraJS/issues/799).
- Recipe `annot()` and `comment()` throw
  `Error: Unknown annotation flag (<name>)` when the `flag` option is not a
  `Recipe.AnnotFlag` value, such as a misspelled name. In 6.x the annotation was
  written without any flag bits. Pass a `Recipe.AnnotFlag` value, a numeric bit
  mask, or omit `flag`; see
  [Check Annotation Flags](getting-started/migrate-from-v6.md#check-annotation-flags) [#792](https://github.com/julianhille/MuhammaraJS/issues/792).
- Recipe `annot()` and `comment()`, and the `highlight`, `underline`,
  `strikeOut`, and `squiggly` options of `text()`, throw
  `TypeError: Invalid annotation options` for values that cannot form a valid
  PDF annotation, as in `@muhammara/wasm`: an `x` or `y` that is neither a
  finite number nor `"center"`, a `width` or `height` that is not a finite
  number of at least zero, an `opacity` outside 0 to 1 (also on a
  reply), a non-finite border width, a `borderDash` with non-numbers, or
  `quadPoints` that are not finite numbers in groups of eight. In 6.x
  `annot()` wrote a string size such as `"40"` into a corrupt `/Rect`, a
  negative size as a reversed rectangle, `NaN` as zero, and `opacity: 2` as an
  invalid `/CA 2`, and `comment()` ignored `width` and `height`. Both wrote
  an `x` or `y` of `NaN` as `nan` and joined a numeric string such as `"50"`
  into the coordinate (`5000`). The call throws before anything is queued or
  drawn. Pass numbers in range, or omit
  the option. Recipe `link()`, and the `link` option of text, shapes and
  images, throw `TypeError: URL link requires a URL and valid PDF rectangle`
  for a URL that is not a string or a rectangle that is not finite, such as
  a `NaN` width, as Wasm does; 6.x wrote the invalid numbers into the link [#853](https://github.com/julianhille/MuhammaraJS/issues/853).
- `Tj()`, `Quote()`, `DoubleQuote()` and `TJ()` throw a `TypeError` when a
  glyph list contains an item that is not a `[glyphId, unicodeCodePoint]`
  array. In 6.x such items were skipped silently, so `TJ(["ab", -100, "c"])`
  drew nothing. Pass the `TJ` items as separate arguments:
  `TJ("ab", -100, "c")`. `TJ("a", -1, glyphs)` also throws now instead of
  dropping the final glyph list as if it were options [#792](https://github.com/julianhille/MuhammaraJS/issues/792).
- The TypeScript declarations of `toPDF*()` and `toNumber()` on PDF objects
  now include `undefined`, which they return for a different object type.
  Strict builds that use the result directly fail with `Object is possibly
'undefined'`; check the result, or `getType()`, before using it [#792](https://github.com/julianhille/MuhammaraJS/issues/792).
- Custom write streams, including `log` targets, now receive each chunk as a
  `Buffer` instead of an array of numbers, and `PDFRStreamForFile#read()` and
  `PDFRStreamForBuffer#read()` return a `Buffer`, as does `read()` on the byte
  readers from `startReadingFromStream()`,
  `startReadingFromStreamForPlainCopying()`, `getParserStream()`, and
  `getSourceDocumentStream()`. Code that calls array methods
  such as `concat`, `push`, or `splice` on those bytes, or checks
  `Array.isArray`, now misbehaves or throws, and TypeScript implementations
  declaring `write(bytes: number[])` fail to compile. Use Buffer operations, or
  `Array.from(bytes)` where an array is required. `ReadStream#read()` is
  declared as returning `Uint8Array | number[]`, so code typing its result as
  `number[]` fails `tsc`. Output also arrives in
  batched chunks of up to 64 KiB, with the last one delivered when the writer
  ends; do not expect one `write` call per PDF token. `write` must return the
  full chunk length: returning less now fails the writer (creation, later
  writes, `end()`, and `shutdown()` throw) instead of being ignored. See
  [Accept Buffers in custom streams](getting-started/migrate-from-v6.md#15-accept-buffers-in-custom-streams)
  [#324](https://github.com/julianhille/MuhammaraJS/issues/324).
- `appendPDFPagesFromPDF()` now ends its writer when copying pages fails.
  Previously callers could continue and produce a corrupted document; create a
  fresh writer and retry with a valid source. A source that cannot be opened,
  parsed, or decrypted, and page ranges outside the source, still throw without
  ending the writer, because nothing was written
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
  [#828](https://github.com/julianhille/MuhammaraJS/issues/828).
- Custom-stream `getCurrentPosition()` results now throw `TypeError` if numeric
  conversion produces a non-finite value or a value outside `[-2^63, 2^63)`.
  Previously these values could produce corrupt PDF offsets. Return the actual
  finite byte position within that range. Numeric strings and other successful
  number coercions remain supported. See the
  [stream contract](low-level/custom-streams.md)
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750).
- Low-level shape helpers now honor `type: "clip"`, ending the path with `W n`
  without painting it. Previously `"clip"` did nothing and unrecognized types
  incorrectly clipped. Any other `type` value, such as the typo `"fil"`,
  `false`, `0`, or `""`, now throws
  `TypeError: Unknown drawing type; use "stroke", "fill", "clip" or null`
  instead of clipping with a stray `W`; `null` now ends the path unpainted
  with `n`, where 6.x clipped it too, and `type: undefined` strokes like an
  omitted `type`. Use `"clip"` explicitly and scope it with `q()`/`Q()`;
  use `"stroke"` or `"fill"` when painting is intended. See the
  [drawing migration](getting-started/migrate-from-v6.md#14-check-low-level-clipping-options)
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792).
- Shape helpers and `writeText()` now finish input conversion before emitting
  operators. Failed getters or coercions no longer leave partial graphics/text
  output; correct the input and retry rather than relying on that partial output.
  Coordinates, dimensions, stroke widths, and text sizes must convert to finite
  numbers; calculated circle and underline geometry must also remain finite.
  `drawPath()` requires at least two complete pairs and rejects malformed or
  extra arguments instead of drawing a prefix. Replace `NaN`/infinities with
  finite values, reduce overflowing geometry, and supply complete pairs. See
  the [drawing migration](getting-started/migrate-from-v6.md#14-check-low-level-clipping-options)
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750).
- Native prebuilds now use Node-API 8 and are named
  `napi-v8-{platform}-{arch}-{libc}.tar.gz` instead of
  `node-v{abi}-{platform}-{arch}-{libc}.tar.gz`. The installed addon now lives
  at `binding/napi-v8/muhammara.node` instead of
  `binding/muhammara.node`. Standard npm installs and
  `require("@muhammara/native")` calls continue to work, but custom mirrors,
  direct archive downloads, deployment scripts, and direct addon imports that
  assume the old names or path must use the Node-API names instead. See
  [Migrate from v6 to v7](getting-started/migrate-from-v6.md#13-update-native-binary-tooling)
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
  [#504](https://github.com/julianhille/MuhammaraJS/issues/504).
- Recipe HTML text keeps text outside any element on one line with its
  neighboring inline elements, and keeps one space between them: `x <b>a</b> y`
  renders as one line `x a y`, as it already did inside `<p>`. Previously each
  top-level text run and inline element started its own line and lost its
  leading space. Wrap content in `<p>` elements or add `<br>` where separate
  lines are intended. `htmlToTextObjects()` now returns a `<br>` as an object
  with `lineBreak: true` instead of a `p` object holding placeholder text
  [#667](https://github.com/julianhille/MuhammaraJS/issues/667).
- Recipe `table()` derives its columns from every record, not just the first,
  keeps `order` and `columns` entries even when no record has that field, and
  uses exactly the listed `columns` when no `order` is given. A column
  `renderer` result now also sizes its row. Existing tables can gain columns,
  reorder them, or grow taller rows, and a misspelled `order` or `columns`
  name now draws an empty column instead of being dropped; list the intended columns with `order` or
  `columns` to keep a fixed layout. See
  [Migrate from v6 to v7](getting-started/migrate-from-v6.md#11-choose-table-columns-explicitly)
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666).
- Recipe table sizing includes vertical padding, minimum/fixed cell heights,
  and rendered HTML. Rows can grow taller and continue earlier; adjust the cell
  sizing or continuation area. If an `overflow` callback continues into an
  area too small for the pending row and repeated header, `table()` now throws
  `RangeError` instead of drawing beyond the bounds. Return `true` to stop or
  provide enough space; see the
  [table migration steps](getting-started/migrate-from-v6.md#11-choose-table-columns-explicitly)
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666).
- Recipe `table()` passes `""` instead of `null` to a column `renderer` for a
  `null` value, and leaves the text cursor at the table's left edge and bottom.
  In 6.x a `null` value made the table fail with an internal `TypeError`, and
  the cursor stayed after the last cell, so a `text()` call without
  coordinates after `table()` now starts below the table. Check for `""` in
  renderers, and pass coordinates to the next `text()`; see the
  [table migration steps](getting-started/migrate-from-v6.md#11-choose-table-columns-explicitly)
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666).
- Native Recipe `charSpace` measurements count every character, including
  leading and trailing whitespace, matching Wasm. 6.x trimmed boundary
  whitespace before counting, so text such as `" Label "` with `charSpace`
  now measures wider, wraps earlier and aligns differently. Trim the text
  before passing it where boundary whitespace should not add spacing; see
  [Trim Boundary Whitespace From `charSpace` Text](getting-started/migrate-from-v6.md#10-trim-boundary-whitespace-from-charspace-text)
  [#661](https://github.com/julianhille/MuhammaraJS/issues/661)
  [#543](https://github.com/julianhille/MuhammaraJS/issues/543).
- Recipe `endPDF()` is now idempotent. Repeated calls that previously attempted
  to finalize the writer again, and could crash, now leave the completed PDF
  unchanged; a repeated `endPDF(callback)` still invokes the callback with the
  completed output where applicable. Code that relied on another call to flush
  later changes must create and finalize a new Recipe instead
  [#693](https://github.com/julianhille/MuhammaraJS/issues/693).
- A failed Recipe `endPDF()` now retires the Recipe, aborts its writer, releases
  its source reader, and rethrows the original error on later calls. Code that
  retried finalization on the same Recipe must create a new Recipe instead. This
  prevents failed finalization from retaining source file handles on Windows
  [#381](https://github.com/julianhille/MuhammaraJS/issues/381).
- Stateful `PDFWriter` calls after `end()` or `shutdown()` now throw
  `Error("PDF writer has ended")` instead of accessing closed resources or
  crashing. Failed finalization also retires the writer. Create a new writer
  with `createWriter()` or `createWriterToModify()`, or resume a saved state
  with `createWriterToContinue()`; `new PDFWriter()` alone is not active.
  Repeated `end()` remains a no-op. See [Writer lifecycle](api/writer.md#lifecycle)
  [#693](https://github.com/julianhille/MuhammaraJS/issues/693).
- Recipe `endPage()` no longer leaves the completed page active. Page methods
  called after `endPage()` throw instead of reusing the completed page and its
  content context: shapes, `image()`, and `link()` with
  `TypeError: No page is active; call createPage() or editPage() first`, and
  `table()`, `overlay()`, `setPageBox()`, `rotate()`, and `pauseContext()` with
  their own errors. `text()` draws nothing, and `comment()` or `annot()` make
  `endPDF()` fail. Call
  `createPage()` or `editPage()` before the next page operation. See
  [Migrate from v6 to v7](getting-started/migrate-from-v6.md#8-reactivate-pages-after-endpage)
  [#608](https://github.com/julianhille/MuhammaraJS/issues/608).
- Recipe `appendPage()` rejects zero, negative, fractional, reversed, and
  malformed page selections. These values were previously clamped, passed to
  the low-level writer, or partially interpreted; pass positive one-based
  integers or ascending two-value ranges instead. Integer endpoints beyond the
  source still clamp to its final page [#548](https://github.com/julianhille/MuhammaraJS/issues/548).
- Recipe `insertPage()` throws `TypeError` immediately when `pdfSrc` or
  `srcPageNumber` is missing. Incomplete calls previously queued no insertion or
  failed later during `endPDF()`; pass `afterPageNumber`, `pdfSrc`, and the
  positive one-based `srcPageNumber` together [#548](https://github.com/julianhille/MuhammaraJS/issues/548).
- Recipe `pauseContext()` and `resumeContext()` throw when there is no matching
  active or paused page content context. Calls outside a page lifecycle and
  repeated pause or resume calls used to do nothing silently; call
  `pauseContext()` only after creating or editing a page, and call
  `resumeContext()` exactly once after a successful pause [#608](https://github.com/julianhille/MuhammaraJS/issues/608).
- The undocumented native `Recipe` prototype members `ANNOTATION_PREFIX`,
  `appendPDFPageFromPDFWithAnnotations()`, and
  `appendPDFPagesFromPDFWithAnnotations()` were removed. Code that called them
  now fails because they were internal helpers, not Recipe APIs; use
  `appendPage()`, `insertPage()`, or `split()` for supported page-copying
  operations [#623](https://github.com/julianhille/MuhammaraJS/issues/623).
- `PDFReader` methods that take a page index or object ID — `parseNewObject()`,
  `getPageObjectID()`, `parsePageDictionary()`, `parsePage()`, and
  `getXrefEntry()` — reject anything that is not a non-negative integer below
  2^32. In 6.x a fractional or out-of-range argument was converted silently:
  `reader.parsePage(1.5)` read the second page, `reader.getPageObjectID(-1)`
  returned `0`, and `NaN` or `Infinity` read index 0. Such values now throw
  `TypeError: Page index must be a non-negative integer` (or
  `Object ID must be a non-negative integer`). Round or validate the value
  before passing it, bounding page indices with `getPagesCount()` and object IDs
  with `getObjectsCount()` [#581](https://github.com/julianhille/MuhammaraJS/issues/581).
- `Recipe.fillOpacity()` was removed. Existing calls now throw because it is no
  longer a Recipe method; use `Recipe.opacity()` to set both fill and stroke
  alpha. Opacity persists for later vector drawing, so call `opacity(1)` to
  restore opaque output. See [Migrate from v6 to v7](getting-started/migrate-from-v6.md#7-replace-recipefillopacity)
  [#618](https://github.com/julianhille/MuhammaraJS/issues/618).
- Three Recipe declarations that 6.x typed more loosely are narrower:
  `rectangle()` `rotationOrigin` is a two-number tuple instead of `number[]`,
  the text `overflow` callback must return `boolean` or overflow instructions
  instead of `void` (a `void` callback already failed at runtime), and
  `lineTo()` options no longer declare the `fill` that 6.x ignored. Such code
  fails `tsc`; annotate the origin as `[number, number]`, return `true` from
  `overflow` to stop, and drop `fill`. See
  [Migrate from v6 to v7](getting-started/migrate-from-v6.md#9-update-recipe-options-and-types)
  [#654](https://github.com/julianhille/MuhammaraJS/issues/654).
- Low-level declarations that 6.x code compiled against are narrower, so such
  code fails `tsc`:
  - `PDFReader#getXrefPosition()` takes no argument; 6.x required one and
    ignored it. Drop the argument.
  - `PDFWStreamForBuffer#buffer` may be `null`; check it before use.
  - `InfoDictionary#trapped` and the `J()` and `j()` arguments take `0`, `1`,
    or `2` instead of any `number`; pass a literal, or a `LineCapStyle`
    constant for `J()`.
  - `eTokenSeparatorSpace`, `eTokenSeparatorEndLine`, and
    `eTokenSeparatorNone` are constants only, no longer types; write
    `typeof muhammara.eTokenSeparatorSpace` where a type is needed.
- The unscoped `muhammara` package is deprecated and receives no further
  releases. Install `@muhammara/native` instead, or use an npm alias when an
  existing `require("muhammara")` import must remain unchanged. See
  [Install as an npm alias](getting-started/installation.md#install-as-an-npm-alias).
- `@muhammara/native` is prebuilt-only. When a matching prebuilt is unavailable,
  installation fails instead of compiling locally; install
  `@muhammara/native-with-source` for bundled source and fallback builds.
- Deep imports such as `require("muhammara/lib/Recipe")` no longer work, also
  under an npm alias: the JavaScript layer moved to `@muhammara/native-core`,
  and the native packages no longer ship a `lib/` directory. Import from the
  package root; see [Update Imports](getting-started/migrate-from-v6.md#3-update-imports)
  [#556](https://github.com/julianhille/MuhammaraJS/issues/556).
- Windows win32 (32-bit) prebuilds and build tooling were removed. Windows x64
  is the current prebuilt target; Windows arm64 is not part of the prebuilt
  matrix.
- Node.js `20 || 22 || 24 || >=25` is required. 6.x declared `>=17` and
  shipped prebuilds for Node.js 19 to 24, so Node.js 17, 18, 19, 21, and 23 are
  no longer supported and npm warns or refuses to install on them. Upgrade to a
  supported Node.js release; see
  [Confirm Prebuilt Coverage](getting-started/migrate-from-v6.md#5-confirm-prebuilt-coverage).
- Recipe requires a text `size`, or its `fontSize` alias, greater than zero and
  throws `RangeError` naming the option and the value otherwise. `text()`
  previously clamped a negative size to 1pt, drew nothing visible for zero, and
  `textDimensions()` measured with those values, returning nonsensical metrics
  such as a width of 2147483645.5 for `size: -5`. Zero and `NaN` previously fell
  back to the 14pt default in some paths, hiding the mistake, and `Infinity`
  wrote an invalid `inf` font size into the page. Pass a finite size
  greater than zero, or omit the option — `null` and `undefined` still select
  the 14pt default. See
  [Migrate from v6 to v7](getting-started/migrate-from-v6.md#12-pass-a-text-size-greater-than-zero)
  [#733](https://github.com/julianhille/MuhammaraJS/issues/733).
- Recipe `text()` throws `TypeError: charSpace must be a finite number` when
  `charSpace` is `Infinity`, `-Infinity`, `NaN`, or not a number, matching
  Wasm. In 6.x `Infinity` wrote an invalid `inf Tc` operand into the page,
  `NaN` silently drew with no character spacing, and a string or boolean threw
  `Wrong Arguments, please provide character space` after drawing had started.
  The check runs before anything is drawn, and the Recipe stays usable. Pass a
  finite number, or omit the option — `null` and `undefined` still mean no
  spacing [#812](https://github.com/julianhille/MuhammaraJS/issues/812).
- `UsedFont#calculateTextDimensions()` throws a `TypeError` when the font size
  is not a finite number greater than zero, matching `@muhammara/wasm`. 6.x
  converted the size to an unsigned integer, so `0`, `NaN`, and infinite sizes
  measured as zero and a negative size wrapped to a huge integer. Pass a size
  greater than zero, or omit it to measure at size 1 [#798](https://github.com/julianhille/MuhammaraJS/issues/798).

## Version 5.x

- Node.js 16 and earlier prebuilds were removed.
- Electron 23 and earlier prebuilds were removed.
- Building from source requires a C++20-capable compiler. CI validates GCC 11.
- Official Docker builds use a GCC Bookworm environment, lowering the required
  `GLIBCXX` version to 3.4.30.

## Version 4.x

- Node.js 15 and earlier and Electron 15 and earlier prebuilds were removed.
- Ubuntu 18.04 was removed from GitHub Actions. Its older glibc can affect use
  of prebuilt binaries; building from source remains an option.

## Version 3.x

- Node.js 11 and earlier and Electron 11 and earlier prebuilds were removed.
- The misspelled `eTokenSeprator` export was renamed to `eTokenSeparator`.

## Version 2.x

- Older Node.js and Electron versions may be incompatible because of the
  node-pre-gyp upgrade.
