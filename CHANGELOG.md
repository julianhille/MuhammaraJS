# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `recryptAsync()`, a promise-returning `recrypt()` that re-encrypts on
  libuv's thread pool, so the event loop keeps running. Jobs run one at a
  time in call order, and waiting jobs do not hold pool threads
  [#98](https://github.com/julianhille/MuhammaraJS/issues/98)
- A server benchmark comparing `recrypt()` and `recryptAsync()`, including
  how long each blocks the event loop, run with `npm run bench:recrypt`
  [#98](https://github.com/julianhille/MuhammaraJS/issues/98)

### Changed

- Native log settings belong to the thread that sets them. A writer created
  in a worker thread no longer changes where writers on other threads log
  [#98](https://github.com/julianhille/MuhammaraJS/issues/98)

## [7.0.0] - 2026-10-01

Upgrading from `muhammara` 6.x? Follow [Migrate from v6 to v7](packages/native/docs/getting-started/migrate-from-v6.md).

### Breaking Changes

Upgrading from 6.x? Each change below is described in [Breaking Changes](packages/native/docs/breaking-changes.md#version-7x); follow [Migrate from v6 to v7](packages/native/docs/getting-started/migrate-from-v6.md) for the upgrade steps.

- Replace the unscoped `muhammara` package, which receives no further
  releases, with `@muhammara/native` or `@muhammara/native-with-source`.
  Existing `require("muhammara")` imports must change, or the package must be
  installed under the documented npm alias; see [Choose the Replacement
  Package](packages/native/docs/getting-started/migrate-from-v6.md#1-choose-the-replacement-package)
- Make `@muhammara/native` prebuilt-only. A missing compatible prebuilt fails
  installation instead of compiling locally; install
  `@muhammara/native-with-source` for source and Electron builds; see [Choose
  the Replacement
  Package](packages/native/docs/getting-started/migrate-from-v6.md#1-choose-the-replacement-package)
- Remove deep imports such as `require("muhammara/lib/Recipe")`: the
  JavaScript layer moved to `@muhammara/native-core`, and the native packages
  no longer ship a `lib/` directory, also under an npm alias. Import from the
  package root instead; see
  [Update Imports](packages/native/docs/getting-started/migrate-from-v6.md#3-update-imports)
  [#556](https://github.com/julianhille/MuhammaraJS/issues/556)
- Require Node.js `20 || 22 || 24 || >=25`. 6.x declared `>=17` and shipped
  prebuilds for Node.js 19 to 24; Node.js 17, 18, 19, 21, and 23 are no longer
  supported, and npm warns or refuses to install on them. Upgrade to a
  supported Node.js release first; see [Confirm Prebuilt
  Coverage](packages/native/docs/getting-started/migrate-from-v6.md#5-confirm-prebuilt-coverage)
- Remove the Windows win32 (32-bit) prebuilds and build tooling. Use Windows
  x64; see [Confirm Prebuilt
  Coverage](packages/native/docs/getting-started/migrate-from-v6.md#5-confirm-prebuilt-coverage)
- Replace the runtime-specific Node.js and Electron native binaries with
  Node-API 8 prebuilds shared by every supported runtime. Standard npm installs
  and package imports need no change, but custom binary mirrors, direct
  archive downloads, and tooling that uses `binding/muhammara.node` must
  replace `node-v{abi}-{platform}-{arch}-{libc}.tar.gz` with
  `napi-v8-{platform}-{arch}-{libc}.tar.gz` and use
  `binding/napi-v8/muhammara.node`; see [Update Native Binary
  Tooling](packages/native/docs/getting-started/migrate-from-v6.md#6-update-native-binary-tooling)
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
  [#504](https://github.com/julianhille/MuhammaraJS/issues/504)
- Clear the completed page and its content context in Recipe `endPage()`
  instead of leaving them active. Page methods called after `endPage()` throw
  instead of reusing the completed page: shapes, `image()`, and `link()` with
  `TypeError: No page is active; call createPage() or editPage() first`, and
  `table()`, `overlay()`, `setPageBox()`, `rotate()`, and `pauseContext()`
  with their own errors. `text()` draws nothing, and `comment()` or `annot()`
  make `endPDF()` fail. Call `createPage()` or `editPage()` before the next
  page operation; see [Reactivate Pages After
  `endPage()`](packages/native/docs/getting-started/migrate-from-v6.md#8-reactivate-pages-after-endpage)
  [#608](https://github.com/julianhille/MuhammaraJS/issues/608)
- Make Recipe `endPDF()` idempotent. A repeated call, which could crash with a
  segmentation fault in 6.x, leaves the completed PDF unchanged, and a repeated
  `endPDF(callback)` still invokes the callback with the completed output.
  Create a new Recipe instead of calling `endPDF()` again to flush later
  changes; see [Check the Recipe
  Lifecycle](packages/native/docs/getting-started/migrate-from-v6.md#check-the-recipe-lifecycle)
  [#693](https://github.com/julianhille/MuhammaraJS/issues/693)
- Retire a Recipe after any `endPDF()` failure: its writer is aborted, its
  source reader released, and later calls rethrow the original error. Code
  that retried the same Recipe must create a new one; see [Check the Recipe
  Lifecycle](packages/native/docs/getting-started/migrate-from-v6.md#check-the-recipe-lifecycle)
  [#381](https://github.com/julianhille/MuhammaraJS/issues/381)
- Throw from Recipe `pauseContext()` and `resumeContext()` when there is no
  matching active or paused page content context, instead of silently doing
  nothing. Call `pauseContext()` only after creating or editing a page, and
  `resumeContext()` once after a successful pause; see [Check the Recipe
  Lifecycle](packages/native/docs/getting-started/migrate-from-v6.md#check-the-recipe-lifecycle)
  [#608](https://github.com/julianhille/MuhammaraJS/issues/608)
- Reject zero, negative, fractional, reversed, and malformed page selections
  in Recipe `appendPage()` instead of clamping or partially interpreting them,
  and throw from `insertPage()` right away when `pdfSrc` or `srcPageNumber` is
  missing instead of queuing nothing or failing in `endPDF()`. Pass positive
  one-based integers or ascending two-value ranges, and all three
  `insertPage()` arguments; integer endpoints beyond the source still clamp to
  its final page; see [Check the Recipe
  Lifecycle](packages/native/docs/getting-started/migrate-from-v6.md#check-the-recipe-lifecycle)
  [#548](https://github.com/julianhille/MuhammaraJS/issues/548)
- Remove Recipe `fillOpacity()`. Use `opacity()`, which sets both fill and
  stroke alpha and persists for later vector drawing, so call `opacity(1)` to
  restore opaque output; see [Replace
  `Recipe.fillOpacity()`](packages/native/docs/getting-started/migrate-from-v6.md#9-replace-recipefillopacity)
  [#618](https://github.com/julianhille/MuhammaraJS/issues/618)
- Remove the accidentally exposed `Recipe` prototype members
  `ANNOTATION_PREFIX`, `appendPDFPageFromPDFWithAnnotations()`, and
  `appendPDFPagesFromPDFWithAnnotations()`. Use `appendPage()`, `insertPage()`,
  or `split()` for page copying; see [Replace
  `Recipe.fillOpacity()`](packages/native/docs/getting-started/migrate-from-v6.md#9-replace-recipefillopacity)
  [#623](https://github.com/julianhille/MuhammaraJS/issues/623)
- Recipe `register()` throws
  `Found conflict in Recipe prototypes. <name> already exists.` for a plugin
  named like a method new in v7: `deletePage`, `getCurrentPageInfo`,
  `lineStyle`, `link`, `opacity`, `pie`, `removeText`, `replaceText`,
  `rotate`, `rotateContent`, or `setPageBox`. Rename the plugin; see
  [Rename Recipe Plugins That Collide With New
  Methods](packages/native/docs/getting-started/migrate-from-v6.md#10-rename-recipe-plugins-that-collide-with-new-methods)
  [#829](https://github.com/julianhille/MuhammaraJS/issues/829)
- Require a Recipe text `size`, or its `fontSize` alias, that is a finite
  number greater than zero, and throw a `RangeError` naming the option and the
  value otherwise, before drawing or measuring. `text()` clamped a negative
  size to 1pt, drew nothing visible for zero, and wrote an infinite size as an
  invalid `inf`; `textDimensions()` returned nonsensical metrics; zero and
  `NaN` fell back to the 14pt default in some paths. Pass a size greater than
  zero, or omit it: `null` and `undefined` still select 14pt; see [Pass Valid
  Recipe
  Options](packages/native/docs/getting-started/migrate-from-v6.md#11-pass-valid-recipe-options)
  [#733](https://github.com/julianhille/MuhammaraJS/issues/733)
  [#798](https://github.com/julianhille/MuhammaraJS/issues/798)
- Throw `TypeError: charSpace must be a finite number` from Recipe `text()`
  when `charSpace` is `Infinity`, `-Infinity`, `NaN`, or not a number, as
  `@muhammara/wasm` does, before anything is drawn. 6.x wrote an invalid
  `inf Tc` operand, drew `NaN` with no spacing, and threw
  `Wrong Arguments, please provide character space` for a string after drawing
  had started. Pass a finite number, or omit the option; see [Pass Valid Recipe
  Options](packages/native/docs/getting-started/migrate-from-v6.md#11-pass-valid-recipe-options)
  [#812](https://github.com/julianhille/MuhammaraJS/issues/812)
- Throw `TypeError: rotation must be a finite number` from Recipe shapes,
  `text()`, and `image()` when `rotation` is neither a number nor a numeric
  string, before anything is drawn. 6.x wrote `NaN` transformation matrices,
  so the shape was missing or broken in viewers. Pass a number, or omit
  `rotation`; see [Pass Valid Recipe
  Options](packages/native/docs/getting-started/migrate-from-v6.md#11-pass-valid-recipe-options)
  [#857](https://github.com/julianhille/MuhammaraJS/issues/857)
- Throw `RangeError: miterLimit must be a number of at least 1` from Recipe
  shapes and `image()` for a `miterLimit` below 1 or not a number, before
  anything is drawn. 6.x wrote the invalid limit into the PDF or ignored a
  non-number. Pass 1 or more, or omit it; see [Pass Valid Recipe
  Options](packages/native/docs/getting-started/migrate-from-v6.md#11-pass-valid-recipe-options)
  [#857](https://github.com/julianhille/MuhammaraJS/issues/857)
- Throw `RangeError: n_gon sides must be a finite number no greater than 100000`
  from Recipe `n_gon()` (`star points …` from `star()`) when the side or point
  count is `NaN`, `Infinity`, not a number, or above 100000. An infinite or
  huge count built vertices until the process ran out of memory and aborted,
  and `NaN` drew nothing. Pass a finite count; see [Pass Valid Recipe
  Options](packages/native/docs/getting-started/migrate-from-v6.md#11-pass-valid-recipe-options)
  [#821](https://github.com/julianhille/MuhammaraJS/issues/821)
- Throw `Error: Unknown annotation flag (<name>)` from Recipe `annot()` and
  `comment()` for a `flag` that is not a `Recipe.AnnotFlag` value, instead of
  silently writing no flag bits, as `@muhammara/wasm` does. Numeric bit masks
  are accepted too. Pass a `Recipe.AnnotFlag` value or a bit mask, or omit
  `flag`; see [Check Annotation
  Flags](packages/native/docs/getting-started/migrate-from-v6.md#check-annotation-flags)
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Throw `TypeError: Invalid annotation options` from Recipe `annot()` and
  `comment()`, and from the `highlight`, `underline`, `strikeOut`, and
  `squiggly` options of `text()`, for values that cannot form a valid PDF
  annotation, as `@muhammara/wasm` does: an `x` or `y` that is neither a
  finite number nor `"center"`, a `width` or `height` that is not a finite
  number of at least zero, an `opacity` outside 0 to 1 (also on a reply), a
  non-finite border width, a `borderDash` with non-numbers, or `quadPoints`
  that are not finite numbers in groups of eight. 6.x wrote such values into
  corrupt or reversed rectangles, `nan` coordinates, or an invalid `/CA`. The
  call throws before anything is queued or drawn. Recipe `link()`, and the
  `link` option of text, shapes and images, throw
  `TypeError: URL link requires a URL and valid PDF rectangle` for a URL that
  is not a string or a rectangle that is not finite. Pass numbers in range, or
  omit the option; see [Check Annotation and Link
  Options](packages/native/docs/getting-started/migrate-from-v6.md#check-annotation-and-link-options)
  [#853](https://github.com/julianhille/MuhammaraJS/issues/853)
- Throw `TypeError: Unknown annotation color (<value>)` from Recipe `annot()`
  and `comment()`, and from text `underline`, `strikeOut`, and `highlight`
  annotations, when `color` is not a known color, instead of writing the
  default color. Known colors are `#rrggbb`, `%r,g,b`, colors registered with
  `chroma()`, and CSS color names in any case, which previously fell back to
  the default too. Gray `#rr` and CMYK `#ccmmyykk` throw as well, and numbers,
  which failed with an internal error in 6.x, now throw this `TypeError`.
  `text()` checks its markup annotations before drawing any text. Fix
  misspelled names or register them with `chroma()`; see [Check Recipe
  Colors](packages/native/docs/getting-started/migrate-from-v6.md#12-check-recipe-colors)
  [#796](https://github.com/julianhille/MuhammaraJS/issues/796)
- Write a one-number annotation `color` array as a gray and a four-number one
  as a CMYK annotation color, as `@muhammara/wasm` does. They were misread as
  RGB, so `[128]` wrote dark blue and CMYK arrays lost a channel. Values
  outside 0 to 255 and other array lengths throw a `TypeError`; pass one,
  three, or four numbers from 0 to 255; see [Check Recipe
  Colors](packages/native/docs/getting-started/migrate-from-v6.md#12-check-recipe-colors)
  [#796](https://github.com/julianhille/MuhammaraJS/issues/796)
- Keep colors registered with Recipe `chroma()` in the Recipe that registered
  them, as `@muhammara/wasm` does. In 6.x every Recipe in the process shared
  one color table. In another Recipe the name is now unknown: text and shape
  colors fall back to the default color, and annotation colors throw
  `TypeError: Unknown annotation color (<name>)`. Register the color on each
  Recipe that uses it; see [Check Recipe
  Colors](packages/native/docs/getting-started/migrate-from-v6.md#12-check-recipe-colors)
  [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
- Stop reading the undocumented `colour` alias of `color` in Recipe; a shape
  or text given only `colour` uses the default color. Rename it to `color`;
  see [Check Recipe
  Colors](packages/native/docs/getting-started/migrate-from-v6.md#12-check-recipe-colors)
  [#857](https://github.com/julianhille/MuhammaraJS/issues/857)
- Throw a `TypeError` for an unknown colorspace, as `@muhammara/wasm` does.
  The low-level drawing and `writeText()` color options throw
  `colorspace must be rgb, gray, or cmyk` for a numeric or named `color`
  instead of drawing without a color or ignoring the colorspace, and Recipe
  `chroma()`, text and drawing options throw `Unknown colorspace: <name>`
  instead of a plain `Error` or an unrelated `TypeError`. The declaration no
  longer accepts any string for `ColorOptions.colorspace`, so a value typed
  `string` fails `tsc`; use `DeviceColorSpace` values; see [Type
  Colorspaces](packages/native/docs/getting-started/migrate-from-v6.md#type-colorspaces)
  [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
- Place Recipe `annot()` rectangles with (x, y) as their top-left corner, like
  `rectangle()` and `link()`. 6.x used (x, y) as the bottom-left corner, so a
  Square, Circle, FreeText, or other annotation with a `height` now appears
  `height` points lower. Subtract `height` from `y` to keep the 6.x position.
  Highlight, Underline, StrikeOut, and Squiggly already hung down from `y` and
  render where they did; their `Rect` now encloses their `QuadPoints`; see
  [Move Recipe Annotations to Their Top-Left
  Corner](packages/native/docs/getting-started/migrate-from-v6.md#move-recipe-annotations-to-their-top-left-corner)
  [#808](https://github.com/julianhille/MuhammaraJS/issues/808)
- Stroke a Recipe `line()` through all of its points as one path, as
  `@muhammara/wasm` does, instead of one path per segment. Segments meet at
  the `lineJoin` instead of overlapping their caps, a translucent line no
  longer darkens where segments overlap, and a Separation line writes one form
  XObject instead of one per segment. To keep separate segments, draw each
  with its own `moveTo()` and `lineTo()`; see [Stroke Recipe Lines as One
  Path](packages/native/docs/getting-started/migrate-from-v6.md#stroke-recipe-lines-as-one-path)
  [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
- Place a Recipe `image()` with `align: "<horizontal> bottom"` half its height
  below the placement point, as documented. 6.x drew it 1.5 times its height
  above that point, so such images now appear twice their height lower; see
  [Move Bottom-Aligned Images Back Where v6 Drew
  Them](packages/native/docs/getting-started/migrate-from-v6.md#move-bottom-aligned-images-back-where-v6-drew-them)
  [#857](https://github.com/julianhille/MuhammaraJS/issues/857)
- Frame a Recipe `image()` given `fill`, `stroke`, or `color`, which 6.x
  ignored for images: `fill` paints beneath the image, and `stroke` or `color`
  outlines it. Leave these options out of `image()` to keep the 6.x output;
  see [Check Recipe Image and Color
  Options](packages/native/docs/getting-started/migrate-from-v6.md#check-recipe-image-and-color-options)
  [#857](https://github.com/julianhille/MuhammaraJS/issues/857)
- Turn a PDF page placed with Recipe `image()` by its `/Rotate` entry, as
  viewers display it; a page turned by 90 or 270 degrees is measured with its
  width and height swapped. 6.x drew it unturned. Pass the size of the
  displayed page; see [Size Rotated and Placed PDF
  Pages](packages/native/docs/getting-started/migrate-from-v6.md#size-rotated-and-placed-pdf-pages)
  [#857](https://github.com/julianhille/MuhammaraJS/issues/857)
- Report a PDF page used as an image as its media box width by height, as
  `@muhammara/wasm` does. 6.x swapped them: for a 595×842 portrait page,
  `getImageDimensions()` returned `{ width: 842, height: 595 }`, `drawImage()`
  with `transformation: { width, height }` scaled each axis by the other's
  size, and Recipe `image()` drew the page at the wrong size and position.
  Remove code that swapped the values back; see [Size Rotated and Placed PDF
  Pages](packages/native/docs/getting-started/migrate-from-v6.md#size-rotated-and-placed-pdf-pages)
  [#856](https://github.com/julianhille/MuhammaraJS/issues/856)
- Count every character, including leading and trailing whitespace such as
  non-breaking spaces, in Recipe `charSpace` measurements, as
  `@muhammara/wasm` does. 6.x trimmed boundary whitespace before counting, so
  text such as `" Label "` with `charSpace` now measures wider, wraps earlier
  and aligns differently. Characters outside the Basic Multilingual Plane,
  such as emoji, count once instead of twice. Trim the text where boundary
  whitespace should not add spacing; see [Trim Boundary Whitespace From
  `charSpace`
  Text](packages/native/docs/getting-started/migrate-from-v6.md#trim-boundary-whitespace-from-charspace-text)
  [#543](https://github.com/julianhille/MuhammaraJS/issues/543)
  [#661](https://github.com/julianhille/MuhammaraJS/issues/661)
- Keep Recipe HTML text outside any element on one line with its neighboring
  inline elements, with one space between them, instead of starting a new line
  for each top-level run and inline element; wrap content in `<p>` or add
  `<br>` where separate lines are intended. `htmlToTextObjects()` returns a
  `<br>` as an object with `lineBreak: true` instead of a placeholder
  paragraph; see [Wrap Recipe HTML Text
  Explicitly](packages/native/docs/getting-started/migrate-from-v6.md#wrap-recipe-html-text-explicitly)
  [#667](https://github.com/julianhille/MuhammaraJS/issues/667)
- Derive Recipe `table()` columns from every record instead of only the first,
  keep `order` and `columns` entries even when no record has that field, and
  use exactly the listed `columns` when no `order` is given. A column
  `renderer` result also sizes its row, and a misspelled `order` or `columns`
  name draws an empty column instead of being dropped. List the intended
  columns with `order` or `columns` to keep a fixed layout; see [Choose Table
  Columns
  Explicitly](packages/native/docs/getting-started/migrate-from-v6.md#16-choose-table-columns-explicitly)
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Include padding, minimum and fixed cell heights, and rendered HTML in Recipe
  table sizing, so tables can grow taller or continue earlier. An `overflow`
  destination too small for a row and its repeated header throws `RangeError`
  instead of drawing beyond the bounds; return `true` to stop or provide a
  large enough area; see [Choose Table Columns
  Explicitly](packages/native/docs/getting-started/migrate-from-v6.md#16-choose-table-columns-explicitly)
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Pass `""` instead of `null` to a table column `renderer` for a `null` value,
  and leave the text cursor at the table's left edge and bottom. 6.x passed
  `null`, and the table then failed with an internal `TypeError`, and it left
  the cursor after the last cell, so a `text()` call without coordinates after
  `table()` now starts below the table. Check for `""` in renderers and pass
  coordinates to the next `text()`; see [Choose Table Columns
  Explicitly](packages/native/docs/getting-started/migrate-from-v6.md#16-choose-table-columns-explicitly)
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)
- Narrow three Recipe declarations that 6.x typed more loosely: `rectangle()`
  `rotationOrigin` is a two-number tuple instead of `number[]`, the text
  `overflow` callback must return `boolean` or overflow instructions instead
  of `void` (a `void` callback already failed at runtime), and `lineTo()`
  options no longer declare the `fill` that 6.x ignored. Such 6.x code fails
  `tsc`; annotate the origin as `[number, number]`, return `true` to stop, and
  drop `fill`; see [Update TypeScript
  Declarations](packages/native/docs/getting-started/migrate-from-v6.md#17-update-typescript-declarations)
  [#654](https://github.com/julianhille/MuhammaraJS/issues/654)
- Tighten low-level declarations that 6.x code compiled against, so such code
  fails `tsc`: `PDFReader#getXrefPosition()` takes no argument;
  `PDFWStreamForBuffer#buffer` may be `null`; `InfoDictionary#trapped` and the
  `J()` and `j()` arguments take `0`, `1`, or `2` instead of any `number`; and
  `eTokenSeparatorSpace`, `eTokenSeparatorEndLine`, and `eTokenSeparatorNone`
  are constants, no longer types. Drop the `getXrefPosition()` argument, check
  `buffer` for `null`, pass a literal `0`, `1`, or `2`, and write
  `typeof muhammara.eTokenSeparatorSpace` where a separator type is needed;
  see [Type Low-Level
  Declarations](packages/native/docs/getting-started/migrate-from-v6.md#type-low-level-declarations)
- Remove the `key` parameter from the
  `InfoDictionary#getAdditionalInfoEntries()` declaration; the runtime ignored
  it and always returned every entry. Calls that pass a key fail `tsc`; drop
  the argument and pick the entry from the returned object. The call also
  works without an argument now; 6.x threw unless it got one; see [Type
  Low-Level
  Declarations](packages/native/docs/getting-started/migrate-from-v6.md#type-low-level-declarations)
  [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Remove the `input` and `options` parameters from the
  `DocumentCopyingContext#getSourceDocumentParser()` declaration; the runtime
  never used them and always returned the parser of the copying context's
  source document. Calls that pass an argument fail `tsc` with
  `Expected 0 arguments`; drop the arguments; see [Type Low-Level
  Declarations](packages/native/docs/getting-started/migrate-from-v6.md#type-low-level-declarations)
  [#320](https://github.com/julianhille/MuhammaraJS/issues/320)
- Remove `strikeOut` and `lineWidth` from the `WriteTextOptions` declaration;
  `writeText()` never read them, so `{ strikeOut: true }` drew nothing.
  Passing them fails `tsc`; draw a line with `drawPath()` or use the Recipe
  `text()` `strikeOut` option instead; see [Type Low-Level
  Declarations](packages/native/docs/getting-started/migrate-from-v6.md#type-low-level-declarations)
  [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
- Declare `toPDF*()` and `toNumber()` on PDF objects as possibly returning
  `undefined`, which they do for a different object type. Strict TypeScript
  code that uses the result directly fails to compile; check the result or
  `getType()` first; see [Type Low-Level
  Declarations](packages/native/docs/getting-started/migrate-from-v6.md#type-low-level-declarations)
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Make the low-level shape helpers honor `type: "clip"`, which clips without
  painting and ends the path with `W n`, and throw
  `TypeError: Unknown drawing type; use "stroke", "fill", "clip" or null` for
  any other `type`, such as the typo `"fil"`, `false`, `0`, or `""`. 6.x did
  not clip for `"clip"` but clipped with a stray `W` for unknown types, and
  for `null` and `undefined`. `null` now ends the path unpainted, and
  `type: undefined` strokes, as an omitted `type` does. Use `"clip"` scoped
  with `q()`/`Q()`, or `"stroke"`/`"fill"` to paint; see [Check Low-Level
  Drawing
  Options](packages/native/docs/getting-started/migrate-from-v6.md#18-check-low-level-drawing-options)
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Validate low-level shape and `writeText()` arguments before drawing, and
  propagate conversion errors instead of aborting or emitting partial output.
  Coordinates, dimensions, stroke widths, and text sizes must be finite, and
  `drawPath()` needs at least two complete coordinate pairs; incomplete paths
  throw instead of silently drawing a prefix. Correct the input before
  retrying; see [Check Low-Level Drawing
  Options](packages/native/docs/getting-started/migrate-from-v6.md#18-check-low-level-drawing-options)
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
- Parse `#rrggbb` color strings in low-level `drawPath()`, `drawCircle()`,
  `drawSquare()`, `drawRectangle()`, and `writeText()`, and throw a
  `TypeError` when a string `color` is neither a CSS color name nor
  `#rrggbb`, as `@muhammara/wasm` does. 6.x drew both black, including hex
  without the `#`. Pass a CSS color name, a `#rrggbb` string, or a 24-bit
  number; see [Check Low-Level Drawing
  Options](packages/native/docs/getting-started/migrate-from-v6.md#18-check-low-level-drawing-options)
  [#796](https://github.com/julianhille/MuhammaraJS/issues/796)
- Throw `TypeError: only a numeric color can use the gray or cmyk colorspace`
  from the low-level drawing helpers and `writeText()` for a color name or
  `#rrggbb` string with `colorspace: "gray"` or `"cmyk"`, as `@muhammara/wasm`
  does. Such a color is RGB; 6.x drew it in RGB and ignored the colorspace.
  Drop `colorspace`, or pass the gray or CMYK color as a number; see [Check
  Low-Level Drawing
  Options](packages/native/docs/getting-started/migrate-from-v6.md#18-check-low-level-drawing-options)
  [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
- Throw a `TypeError` from `Tj()`, `Quote()`, `DoubleQuote()` and `TJ()` when
  a glyph list contains an item that is not a `[glyphId, unicodeCodePoint]`
  array. Previously such items were skipped, so `TJ(["ab", -100, "c"])` wrote
  an empty `[ () ] TJ`; pass the `TJ` items as separate arguments instead:
  `TJ("ab", -100, "c")`. `TJ()` with text items also throws when a glyph list
  comes last instead of treating it as the options object and dropping it; see
  [Check Low-Level Drawing
  Options](packages/native/docs/getting-started/migrate-from-v6.md#18-check-low-level-drawing-options)
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Throw a `TypeError` from `UsedFont#calculateTextDimensions()` when the font
  size is not a finite positive number, as `@muhammara/wasm` does. 6.x
  measured a size of `0`, `NaN`, or `Infinity` as zero and wrapped a negative
  size to a huge integer. Pass a size greater than zero, or omit it to measure
  at size 1; see [Check Low-Level Drawing
  Options](packages/native/docs/getting-started/migrate-from-v6.md#18-check-low-level-drawing-options)
  [#798](https://github.com/julianhille/MuhammaraJS/issues/798)
- Deliver custom write stream and `log` chunks as `Buffer`s instead of arrays
  of numbers, and return `Buffer`s from `PDFRStreamForFile#read()`,
  `PDFRStreamForBuffer#read()`, and the byte readers returned by
  `startReadingFromStream()`, `startReadingFromStreamForPlainCopying()`,
  `getParserStream()`, and `getSourceDocumentStream()`. Code using array
  methods on those bytes, or TypeScript streams declaring
  `write(bytes: number[])`, must switch to Buffer operations.
  `ReadStream#read()` is declared as returning `Uint8Array | number[]`, so
  code typing its result as `number[]` fails `tsc`. Output arrives in batched
  chunks of up to 64 KiB, with the last one delivered when the writer ends,
  and `write` must return the full chunk length: returning less now fails the
  writer instead of being ignored; see [Accept Buffers in Custom
  Streams](packages/native/docs/getting-started/migrate-from-v6.md#19-accept-buffers-in-custom-streams)
  [#324](https://github.com/julianhille/MuhammaraJS/issues/324)
- Reject custom-stream `getCurrentPosition()` results that convert to
  non-finite numbers or fall outside `[-2^63, 2^63)` with `TypeError`,
  preventing corrupt PDF offsets. Return the actual finite byte position;
  numeric coercion remains supported; see [Accept Buffers in Custom
  Streams](packages/native/docs/getting-started/migrate-from-v6.md#19-accept-buffers-in-custom-streams)
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
- Reject stateful `PDFWriter` calls after `end()` or `shutdown()` with
  `Error("PDF writer has ended")`, including after finalization failures,
  instead of accessing closed resources or crashing. Create a new writer, or
  resume saved state with `createWriterToContinue()`; a direct
  `new PDFWriter()` cannot perform stateful operations; see [Handle Writer
  and Reader
  Errors](packages/native/docs/getting-started/migrate-from-v6.md#20-handle-writer-and-reader-errors)
  [#693](https://github.com/julianhille/MuhammaraJS/issues/693)
- Throw `Error: End the active objects context operation before ending the PDF`
  from `PDFWriter#end()` while a dictionary started with `startDictionary()` is
  still open, as Wasm does, and keep the writer usable. 6.x wrote the
  cross-reference table and trailer inside the open dictionary. End every
  dictionary before `end()`; see [Handle Writer and Reader
  Errors](packages/native/docs/getting-started/migrate-from-v6.md#20-handle-writer-and-reader-errors)
  [#815](https://github.com/julianhille/MuhammaraJS/issues/815)
- End the writer when `appendPDFPagesFromPDF()` fails while copying pages,
  instead of letting callers continue into a corrupted document. A source that
  cannot be opened, parsed, or decrypted, or a page range outside the source,
  throws before anything is written and leaves the writer usable. After a copy
  failure, create a fresh writer and retry with a valid source; see [Handle
  Writer and Reader
  Errors](packages/native/docs/getting-started/migrate-from-v6.md#20-handle-writer-and-reader-errors)
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
  [#828](https://github.com/julianhille/MuhammaraJS/issues/828)
- Throw a `TypeError` from the `PDFReader` methods that take a page index or
  object ID (`parseNewObject()`, `getPageObjectID()`, `parsePageDictionary()`,
  `parsePage()`, and `getXrefEntry()`) instead of converting the argument
  silently. In 6.x `reader.parsePage(1.5)` read the second page,
  `reader.getPageObjectID(-1)` returned `0`, and `NaN` or `Infinity` read
  index 0; such values now throw
  `TypeError: Page index must be a non-negative integer` (or
  `Object ID must be a non-negative integer`). Pass a non-negative integer
  below 2^32; see [Handle Writer and Reader
  Errors](packages/native/docs/getting-started/migrate-from-v6.md#20-handle-writer-and-reader-errors)
  [#581](https://github.com/julianhille/MuhammaraJS/issues/581)

### Added

- Publish the shared `@muhammara/native-core` runtime, the prebuilt-only
  `@muhammara/native`, and the source-capable `@muhammara/native-with-source`
  packages, with npm alias support for existing imports, and add
  `muhammara-clean-source` to remove the bundled C++ sources after a
  successful native build.
- Add Node.js 25 and 26 support [#516](https://github.com/julianhille/MuhammaraJS/issues/516)
- Add Electron 38.x through 44.x prebuilds, built with V8 external pointer
  tags, and test up to Electron 44.4.5 on Linux x64, macOS arm64, and Windows
  x64. Only the newest patch release of each supported minor is built
  [#537](https://github.com/julianhille/MuhammaraJS/issues/537)
  [#748](https://github.com/julianhille/MuhammaraJS/issues/748)
  [#753](https://github.com/julianhille/MuhammaraJS/issues/753)
- Bundle a pinned OpenSSL 3.5.4 statically in the official native prebuilds.
- Write PDF 2.0: the writer accepts PDF 2.0, and Recipe `version: 2.0` writes
  a PDF 2.0 header instead of falling back to 1.7; unsupported values still
  fall back to 1.7 [#551](https://github.com/julianhille/MuhammaraJS/issues/551)
- Add `PDFReader#extractPageText()` for enumerating the text operations of a
  page's content stream. Each element has a decoded Unicode `text` field,
  decoded through the font's `/ToUnicode` CMap, `/Encoding`, and
  `/Differences`, while `content` keeps the raw character codes and
  `{ decodeText: false }` skips decoding. The text-to-page matrix follows
  text-positioning and `cm` operations, and inline-image bytes are never
  reported as text. An optional `limits` argument tightens the extraction
  budget, and a page over budget throws an `Error`, as in the Wasm reader
  [#673](https://github.com/julianhille/MuhammaraJS/issues/673)
  [#670](https://github.com/julianhille/MuhammaraJS/issues/670)
  [#275](https://github.com/julianhille/MuhammaraJS/issues/275)
  [#788](https://github.com/julianhille/MuhammaraJS/issues/788)
- Add `PDFReader#extractPageContentItems()` for detecting page-marking content
  operations, with the same `limits` argument, plus the documented extraction
  budget and runnable `detect-blank-pages` and `find-text-positions` examples
  [#275](https://github.com/julianhille/MuhammaraJS/issues/275)
- Add `PDFWriter#replaceObject()` for page-scoped indirect object replacement,
  with optional global scope [#315](https://github.com/julianhille/MuhammaraJS/issues/315)
- Add Recipe `replaceText()` for replacing text in a page content stream. It
  matches `text` literally through the page font, so it replaces text written
  with composite fonts and `/Differences` encodings, accepts any Unicode
  `text` and `replacement`, inserts `replacement` verbatim, and keeps the
  page's other non-ASCII bytes intact. A replacement needing a glyph the font
  lacks throws an `Error` naming the missing characters; an unreadable font or
  malformed `/Widths` array throws too, and a page that does not exist throws
  a `RangeError`. A guide covers what to do when nothing matches or a glyph is
  missing [#315](https://github.com/julianhille/MuhammaraJS/issues/315)
  [#785](https://github.com/julianhille/MuhammaraJS/issues/785)
  [#788](https://github.com/julianhille/MuhammaraJS/issues/788)
- Add Recipe `removeText(pageNumber, { forms })` to remove all shown text from
  an existing page, for example before adding a new OCR text layer, and a
  guide for replacing a PDF's text layer
  [#388](https://github.com/julianhille/MuhammaraJS/issues/388)
  [#829](https://github.com/julianhille/MuhammaraJS/issues/829)
- Add chainable Recipe `deletePage(pageNumbers, options)` for removing pages
  from an existing PDF while preserving retained page objects. It validates
  when called, so a page referenced by retained structures, an invalid page
  tree or page labels, or a nonzero-generation rewrite throws right away and
  leaves the queued deletions and the rest of the Recipe unchanged; malformed
  page trees and PageLabels are reported with their own errors. Renumbered
  page labels are attached when the catalog is written. The
  `pruneReferences` option removes references to the deleted pages from
  outlines, link annotations, named destinations, form widgets, tagged-PDF
  structure elements and the open action instead of refusing the deletion;
  see [Delete Pages](packages/native/docs/how-to/delete-pages.md)
  [#548](https://github.com/julianhille/MuhammaraJS/issues/548)
  [#826](https://github.com/julianhille/MuhammaraJS/issues/826)
  [#829](https://github.com/julianhille/MuhammaraJS/issues/829)
- Add Recipe `setPageBox(box, left, bottom, right, top)`, as `@muhammara/wasm`
  has, to set the media, crop, bleed, trim, or art box of a new page from an
  `ePDFPageBox*` constant such as `muhammara.ePDFPageBoxCropBox` or a
  `PageBox` name such as `PageBox.CROP`; a BigInt coordinate throws a
  `TypeError`; see [Set Page Boxes](packages/native/docs/how-to/set-page-boxes.md)
  [#619](https://github.com/julianhille/MuhammaraJS/issues/619)
  [#829](https://github.com/julianhille/MuhammaraJS/issues/829)
- Add Recipe `rotate()` to set `/Rotate` on a page created with
  `createPage()`, including pages created with explicit dimensions, as Wasm
  Recipe does. It throws `rotate requires an active page` without a page,
  `Error: rotate() is only available on pages created with createPage()` on a
  page opened with `editPage()`, which keeps its source rotation, and
  `RangeError: Rotation must be a multiple of 90 degrees` for other angles
  [#620](https://github.com/julianhille/MuhammaraJS/issues/620)
  [#827](https://github.com/julianhille/MuhammaraJS/issues/827)
  [#829](https://github.com/julianhille/MuhammaraJS/issues/829)
- Add Recipe `rotateContent()` for rotating subsequent drawing around a point,
  as Wasm does [#616](https://github.com/julianhille/MuhammaraJS/issues/616)
- Add Recipe `pie()` for closed, fillable arc wedges, as Wasm does
  [#615](https://github.com/julianhille/MuhammaraJS/issues/615)
- Add Recipe `getCurrentPageInfo()` for the geometry of the active page, as
  Wasm does [#621](https://github.com/julianhille/MuhammaraJS/issues/621)
- Add Recipe `opacity()` for fill and stroke alpha
  [#618](https://github.com/julianhille/MuhammaraJS/issues/618)
- Add context opacity support for transparent text
  [#496](https://github.com/julianhille/MuhammaraJS/issues/496)
- Add Recipe `lineStyle()` with Wasm-compatible width, cap, join, miter, and
  dash options. `null` options act like omitted options, and a `miterLimit`
  below 1 or not a number throws
  `RangeError: miterLimit must be a number of at least 1`, as shapes do
  [#617](https://github.com/julianhille/MuhammaraJS/issues/617)
  [#829](https://github.com/julianhille/MuhammaraJS/issues/829)
  [#857](https://github.com/julianhille/MuhammaraJS/issues/857)
- Add Recipe `link()` with the top-left coordinate signature Wasm has, and a
  `link` option for rendered text, images, and drawing bounds. Links of
  shapes drawn at `"center"` coordinates and of images placed with `center`
  get a valid rectangle. Text links stay on their page when an `overflow`
  callback changes pages or an `onClip` callback ends the page, and are
  limited to the visible region with `textBox.wrap: "clip"`
  [#614](https://github.com/julianhille/MuhammaraJS/issues/614)
  [#718](https://github.com/julianhille/MuhammaraJS/issues/718)
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
  [#857](https://github.com/julianhille/MuhammaraJS/issues/857)
- Add opt-in fixed-height clipping and an `onClip` callback to Recipe text
  boxes; text-markup annotations of clipped text stay within the visible
  region [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Add Recipe `annot()` opacity and `comment()` replies, and accept the
  `@muhammara/wasm` annotation options: `border` as `{ width, dash }` as well
  as a number, `borderWidth` and `borderDash`, custom `quadPoints`, `contents`
  for an empty `text`, `name` for an omitted `icon`, `flags` for an omitted
  `flag`, and a `Date` for `date`. Replies keep their own `open`, `icon`, and
  `name`, and accept `contents` and `flags`. A negative border width writes no
  `/Border`. `comment()` accepts `width` and `height` like `annot()`, with
  (x, y) as the top-left corner; 6.x ignored both
  [#606](https://github.com/julianhille/MuhammaraJS/issues/606)
  [#853](https://github.com/julianhille/MuhammaraJS/issues/853)
- Add a `page` option to Recipe `image()` that selects the page of a PDF
  source, one-based as in `overlay()`; a `page` past the last page throws
  `Unknown image`, and one that is not an integer from 1 to 4294967296 throws
  a `RangeError`. A frame drawn with `fill`, `stroke`, or `color` is styled by
  `lineWidth`, `dash`, `dashPhase`, `lineCap`, `lineJoin`, and `miterLimit`,
  with the image's rotation, skew, and opacity, and `debug` outlines the image
  box and marks the placement point; see [Place and Transform
  Images](packages/native/docs/how-to/place-and-transform-images.md)
  [#857](https://github.com/julianhille/MuhammaraJS/issues/857)
- Add Recipe constants for the string options Recipe accepts, with a matching
  `Recipe.<Name>` type used by the options: `Recipe.AnnotFlag`, `AnnotIcon`,
  `AnnotSubtype`, `ArrowAt`, `ArrowType`, `ChromaCommand`, `Colorspace`,
  `Coordinate`, `FontStyle`, `HorizontalAlign`, `LineCap`, `LineJoin`,
  `PageLayout`, `PageSize`, `Permission`, `Source`, `TableRowNth`,
  `TextAlign`, `TextWrap`, `TriangleTrait`, `TrianglePosition` and
  `VerticalAlign`. The plain strings stay accepted, and the text `align`
  option is typed as alignment keywords while still accepting other strings
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Add frozen constant objects, named and valued as in `@muhammara/wasm`:
  `DeviceColorSpace`, `PageBox`, `PDFImageType`, and `EEncoding`;
  `DrawingPathType` for the `type` option of the low-level drawing helpers;
  `ImageFit` for the `fit` option of `drawImage()` transformations; and
  `ObjectReplacementScope` for the `scope` option of
  `PDFWriter#replaceObject()` [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Add named Recipe types for metadata, HTML text objects, colors,
  permissions, registered extensions, layouts, tables, text boxes, markup, and
  vector shapes, and declare the documented Recipe metadata and call forms,
  including font styles, overlay shortcuts, flowing text, centered text and
  images, text style and image transformation options, `fill()`, `stroke()`,
  and `fillAndStroke()` without arguments, the `text`, `border`, `color` and
  `followOriginalPageRotation` options of `annot()`, and the `password`,
  `ownerPassword`, `userPassword`, `userProtectionFlag` and `fontSrcPath`
  constructor options
  [#625](https://github.com/julianhille/MuhammaraJS/issues/625)
  [#628](https://github.com/julianhille/MuhammaraJS/issues/628)
  [#654](https://github.com/julianhille/MuhammaraJS/issues/654)
  [#735](https://github.com/julianhille/MuhammaraJS/issues/735)
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Declare the low-level API the native addon already accepts: TIFF options
  for `createFormXObjectFromTIFF()`, the image index and password of
  `getImageDimensions()`, a `PDFReader` source and password for
  `createPDFCopyingContext()`, any read stream for the JPEG, PNG, TIFF and
  merge methods, `PDFLiteralString#toBytesArray()`, PDF objects as the values
  of `PDFDictionary#toJSObject()`, and the missing `PDFReader` methods and
  `PDFObjectParser` interface
  [#479](https://github.com/julianhille/MuhammaraJS/issues/479)
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Accept the call forms Wasm accepts: `Recipe#line(startX, startY, endX, endY,
options?)`, a `PDFDate` in `InfoDictionary#setCreationDate()` and
  `setModDate()`, a form XObject object ID in `doXObject()`, a media box
  default for the `createFormXObjectFromPDFPage()` page box, and a default
  dash phase of 0 for `d()` [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Accept a `Uint8Array` (or `Buffer`) from custom read streams and in the
  `write()` method of PDF stream writers such as `getWriteStream()`, alongside
  arrays of byte values [#324](https://github.com/julianhille/MuhammaraJS/issues/324)
- Add guides for annotating known text regions with Underline or StrikeOut
  annotations, inspecting PDF dictionaries and their indirect objects with the
  low-level reader, reading PDF bookmarks, watermarking a PDF in place or a
  `Buffer`, adding standard and custom Info metadata to an existing PDF, and
  editing or removing an existing annotation, with runnable examples executed
  by the documentation test suite
  [#290](https://github.com/julianhille/MuhammaraJS/issues/290)
  [#328](https://github.com/julianhille/MuhammaraJS/issues/328)
  [#370](https://github.com/julianhille/MuhammaraJS/issues/370)
  [#297](https://github.com/julianhille/MuhammaraJS/issues/297)
  [#450](https://github.com/julianhille/MuhammaraJS/issues/450)
  [#385](https://github.com/julianhille/MuhammaraJS/issues/385)
- Document writer encryption, reader passwords, continuation state, the
  previously undocumented public low-level exports, Recipe's bundled fonts and
  zero-setup text, the absence of writer events in Wasm, and pnpm 10
  installation approval, and link the package READMEs and executable examples
  to the documentation, which is self-contained and generated on Read the Docs
  [#566](https://github.com/julianhille/MuhammaraJS/issues/566)
  [#613](https://github.com/julianhille/MuhammaraJS/issues/613)
  [#624](https://github.com/julianhille/MuhammaraJS/issues/624)
  [#629](https://github.com/julianhille/MuhammaraJS/issues/629)
  [#630](https://github.com/julianhille/MuhammaraJS/issues/630)
  [#689](https://github.com/julianhille/MuhammaraJS/issues/689)
  [#740](https://github.com/julianhille/MuhammaraJS/issues/740)

### Fixed

- Update the bundled libpng from 1.6.37 to 1.6.59, which fixes security
  issues in decoding untrusted PNG images, among them the use-after-frees
  CVE-2026-33416, CVE-2026-34757, and CVE-2026-46675; placed PNG images are
  unchanged [#863](https://github.com/julianhille/MuhammaraJS/issues/863)
- Update the bundled libtiff from 4.6.0 to 4.7.2, which fixes memory-safety
  bugs when reading malformed TIFF images, including CVE-2023-52356 and
  CVE-2024-7006 [#865](https://github.com/julianhille/MuhammaraJS/issues/865)
- Update the bundled FreeType from 2.13.0 to 2.14.3, which fixes an
  out-of-bounds write when parsing TrueType GX and variable font data
  (CVE-2025-27363) in fonts embedded or read from PDFs [#864](https://github.com/julianhille/MuhammaraJS/issues/864)
- Decode `DCTDecode` streams with `startReadingFromStream()` in Electron on
  Linux, where they read as empty. On Linux the addon no longer exports the
  symbols of its bundled libjpeg, FreeType, libpng, zlib, LibTiff, and
  OpenSSL, so a copy of one of them already loaded in the process, such as
  the libjpeg GTK brings into Electron, no longer takes over its calls [#866](https://github.com/julianhille/MuhammaraJS/issues/866)
- Update `serialize-javascript` to 7.1.2 and `mkdocs-material` to 9.7.7 for
  security vulnerability fixes
  [#600](https://github.com/julianhille/MuhammaraJS/issues/600)
- Fix leaks and unsafe cleanup in the bundled PDF-Writer: release xref
  streams and their Flate buffers after writing, previous-xref trailers and
  filter readers on parser failure, and copied stream dictionaries and
  combined page-tree objects on failure; correct CFF array deallocation;
  harden Type 1 decoder arithmetic; and clean up failed writer dictionaries
  and related parser, encryption, and stream ownership defects.
- Fix a memory leak caused by adding a document context extender instead of
  removing it, and release addon constructors deterministically during Node.js
  environment cleanup.
- Prevent JS stream readers from overflowing native buffers
  [#518](https://github.com/julianhille/MuhammaraJS/issues/518)
- Remove the Node.js 24 URL deprecation warnings by updating node-pre-gyp
  [#508](https://github.com/julianhille/MuhammaraJS/issues/508)
- Fix the `DictionaryContext#writeKey()` declaration to include its required
  key parameter [#479](https://github.com/julianhille/MuhammaraJS/issues/479)
- Keep a PDF page placed with Recipe `image()` in its box when its media box
  does not start at 0,0; it was shifted out of it. Numeric strings are
  accepted as `width`, `height`, and `scale`, which threw a binding
  `TypeError`, another value that is not a finite number throws a
  `RangeError`, `null` options no longer throw a `TypeError`, and an omitted
  `keepAspectRatio` is no longer added to the caller's options object
  [#857](https://github.com/julianhille/MuhammaraJS/issues/857)
- Write no `/M` for a Recipe annotation without a `date`, and write a `date`
  that is not a valid date as the text given, as `@muhammara/wasm` does. 6.x
  wrote the invalid PDF date `D:00000100000000-00'00'` for both
  [#853](https://github.com/julianhille/MuhammaraJS/issues/853)
- Write a valid `/Rect` for a Recipe `annot()` or `comment()` without `width`
  or `height` on a rotated page; it contained `nan`
  [#853](https://github.com/julianhille/MuhammaraJS/issues/853)
- Keep the minutes of the time zone offset when a JavaScript `Date` becomes
  a PDF date, as `@muhammara/wasm` does. In a zone such as India (UTC+05:30)
  `createPDFDate()`, `PDFDate`, the Info dates and Recipe annotation dates
  wrote `+05'00'`, 30 minutes off the actual time
  [#854](https://github.com/julianhille/MuhammaraJS/issues/854)
- Stop `createPDFDate()`, `setCreationDate()`, and `setModDate()` from
  aborting the process on a rejected argument on Node.js 20; they raise the
  `TypeError` on its own. `createPDFDate()` without an argument keeps
  returning an empty date, and its declaration accepts the `string | Date` it
  has always accepted [#693](https://github.com/julianhille/MuhammaraJS/issues/693)
- Type `Recipe#info()` without options as `Record<string, string> | undefined`,
  the Info record it returns, instead of `Recipe`; chaining on it always
  failed at runtime [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
- Preserve custom Info dictionary keys passed to Recipe `info(options)`, as
  Wasm does, instead of silently discarding them; `custom(key, value)` remains
  the explicit spelling [#607](https://github.com/julianhille/MuhammaraJS/issues/607)
- Fix `Recipe#endPDF()` throwing `Node-API call failed` when the source PDF
  Info dictionary has a `/Trapped` entry; the entry is now kept
  [#779](https://github.com/julianhille/MuhammaraJS/issues/779)
- Prevent a segmentation fault when a stream started with
  `objectsContext.startPDFStream()` and never passed to `endPDFStream()` is
  garbage-collected, or when its writer is collected or the process exits
  [#842](https://github.com/julianhille/MuhammaraJS/issues/842)
- Prevent a segmentation fault when a form started with `createFormXObject()`
  and never passed to `endFormXObject()` is garbage-collected, or when its
  writer is collected or the process exits; `end()` on such a writer throws
  `Unable to end PDF` [#814](https://github.com/julianhille/MuhammaraJS/issues/814)
- Release the content stream of a page whose content context was never
  written, and of a `PDFPageModifier` whose context was never written, when
  the writer ends or when the page, modifier, or writer is garbage-collected.
  Each kept about 0.5 MB, so every abandoned writer or Recipe, such as one left
  by an error, leaked. `end()` no longer fails after an unwritten page modifier
  was garbage-collected
  [#823](https://github.com/julianhille/MuhammaraJS/issues/823)
- Fix a crash (use-after-free) in `_abort()` and Recipe error recovery after a
  dictionary was left open, for example by a failed `image()`: PDF-Writer's
  cleanup wrote the dictionary's closing `>>` into the already closed output.
  Open dictionaries are now released without writing, a local change to the
  vendored PDF-Writer. A numeric-string Recipe `opacity` such as `"0.5"`,
  which left such a dictionary open, is written as a number, as Wasm does
  [#815](https://github.com/julianhille/MuhammaraJS/issues/815)
- Fix a crash when editing a page of a malformed PDF, such as one whose
  `/Annots` is not an array, whose `/Contents` does not resolve or holds
  direct values, or whose `/Resources` is not a dictionary. The edit is now
  written and the malformed entry is dropped or replaced, a local change to
  the vendored PDF-Writer [#816](https://github.com/julianhille/MuhammaraJS/issues/816)
- Throw instead of crashing when a form is passed to `endFormXObject()` twice,
  already ended, created from an image, or started in another writer
  (`endFormXObject requires an open form from this writer`), when a stream is
  passed to `endPDFStream()` twice (`Unable to end PDF stream`), and when a
  page, form, or objects-context stream or its write stream is used after it
  was paused or ended; `getContentContext()` and `getContentStream()` of an
  ended form throw as in `@muhammara/wasm`
  [#818](https://github.com/julianhille/MuhammaraJS/issues/818)
- Throw `PDF writer has ended`, `PDF reader has ended`, or a similar error
  instead of crashing when an object obtained from a writer, reader, page,
  copying context, or file is used after its owner ended: content contexts
  after `end()` or `writePage()`, objects and dictionary contexts, used fonts,
  page modifiers, modified-file parsers, copying contexts, event dictionaries
  after the event, parsed pages and stream readers after `reader.end()`, and
  file streams after `closeFile()`
  [#668](https://github.com/julianhille/MuhammaraJS/issues/668)
  [#693](https://github.com/julianhille/MuhammaraJS/issues/693)
  [#817](https://github.com/julianhille/MuhammaraJS/issues/817)
- Throw instead of crashing when `replaceObject()`,
  `createPDFCopyingContextForModifiedFile()`, or `new PDFPageModifier()` is used
  with a writer that does not modify a PDF, and when Recipe `editPage()` is
  called on a new document
  [#819](https://github.com/julianhille/MuhammaraJS/issues/819)
- Throw instead of crashing when a writer's `end()` or `_abort()`, a reader's
  `end()`, or a copying context's `end()` is called from a stream `write()`,
  `read()`, or `getCurrentPosition()` callback, a log stream, or a writer
  event that the object is still using
  [#820](https://github.com/julianhille/MuhammaraJS/issues/820)
- Release writer stream proxies and mark the writer ended when finalization
  fails, so a later `end()` call does not re-enter finalization [#677](https://github.com/julianhille/MuhammaraJS/issues/677)
- Keep the writer usable after a failed `createImageXObjectFromJPG()`,
  `createFormXObjectFromJPG()`, `createFormXObjectFromPNG()`,
  `createFormXObjectFromTIFF()`, or `getFontForFile()`. The failed load left
  an object that was never written, or a cached empty font, so `end()` threw
  `Unable to end PDF` and the whole document was lost. The object IDs a failed
  load allocated are now freed, and a font that failed to load is skipped when
  fonts are written, a local change to the vendored PDF-Writer. Recipe
  `image()` throws `Error: Unknown image: <path>` for an image that cannot be
  read, such as a missing file, as Wasm does, instead of drawing it and
  failing in `endPDF()` [#825](https://github.com/julianhille/MuhammaraJS/issues/825)
- Reject invalid TIFF color arrays before processing the image instead of
  continuing with fallback colors or terminating the process during conversion
  [#752](https://github.com/julianhille/MuhammaraJS/issues/752)
- Prevent a crash or hang when `appendPDFPagesFromPDF()` fails on a modifying
  writer with a malformed source such as a PDF with a broken page tree
  [#769](https://github.com/julianhille/MuhammaraJS/issues/769)
- Throw `Unable to read PDF stream` from `startReadingFromStream()` and
  `startReadingFromStreamForPlainCopying()`, and
  `Unable to read PDF stream objects` from `startReadingObjectsFromStream()`,
  when a stream cannot be read, such as one whose indirect `/Length` is not a
  number, instead of crashing the process [#778](https://github.com/julianhille/MuhammaraJS/issues/778)
- Clamp `PDFRStreamForFile` and `PDFRStreamForBuffer` seek methods to the
  available bytes, allowing PDFs smaller than the parser's trailer window to be
  read through built-in streams [#784](https://github.com/julianhille/MuhammaraJS/issues/784)
- Keep memory bounded and throughput high while PDF bytes pass through
  JavaScript streams. Modifying a 48 MB PDF with a Buffer-mode `Recipe` drops
  from about 2.2 GB and 16 seconds to about 300 MB and half a second.
  Encrypting into a JavaScript stream with `recrypt()` batches RC4 output
  instead of making one call per byte: a 48 MB PDF now takes under a second
  instead of running out of memory or taking tens of minutes, and
  `PDFWStreamForBuffer` no longer copies its whole contents on every write [#324](https://github.com/julianhille/MuhammaraJS/issues/324)
- Release copying contexts created by `PDFPageMergingHelper` after file- and
  stream-based merges instead of retaining their parser and source resources
  [#759](https://github.com/julianhille/MuhammaraJS/issues/759)
- Release the source PDF file handle that `Recipe` holds, so the source,
  appended, and overlaid files can be deleted right after `endPDF()` instead of
  failing with `EBUSY` on Windows, and release the file handles
  `appendPage()` opens when the appended PDF cannot be read or a page cannot
  be copied, and those held after any `endPDF()` failure
  [#381](https://github.com/julianhille/MuhammaraJS/issues/381)
- Detach a `createWriterToContinue()` stream log target when the writer ends;
  the next warning from any reader or writer wrote through freed memory and
  terminated the process. `PDFWriterToContinueOptions.log` is typed to accept
  synchronous `ByteWriter` log streams as well as file paths
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
- Prefer `getentropy()` for native Linux CSPRNG calls when OpenSSL is unavailable [#742](https://github.com/julianhille/MuhammaraJS/issues/742)
- Preserve embedded NUL bytes in the low-level `TJ()`, `Tj()`, `Quote()`, and
  `DoubleQuote()` strings instead of truncating each string at the first NUL,
  and honour their `encoding` option: an inverted comparison swapped `"hex"`
  and `"code"` and turned `"text"` into `"hex"`. They now match the Wasm
  package: `"hex"` writes a hex string, `"code"` a literal string, and
  `"text"` the font-encoded default
  [#683](https://github.com/julianhille/MuhammaraJS/issues/683)
- Measure `UsedFont#calculateTextDimensions()` at the exact font size; a
  fractional size such as `10.5` was truncated to `10` [#798](https://github.com/julianhille/MuhammaraJS/issues/798)
- Accept a pattern name alone in `SCN` and `scn`, emitting `/P0 SCN` to select a
  colored (PaintType 1) tiling pattern instead of throwing [#797](https://github.com/julianhille/MuhammaraJS/issues/797)
- Draw a low-level `color` with an empty `colorspace` in RGB, as an omitted
  colorspace does and as `@muhammara/wasm` does; it was drawn without setting
  a color [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
- Fix native type declarations that rejected working calls or accepted failing
  ones: the low-level drawing `type` accepts the documented `null`, typed as
  `DrawingPathType` so unsupported paint modes stay a compile error;
  `addFormXObjectMapping()` takes a form id; `mergePDFPageToFormXObject()`
  takes the target form; `TJ()` takes its items as separate arguments;
  `Tj()`, `Quote()` and `DoubleQuote()` accept an `{ encoding }` options
  object; `mergePDFPagesToPage()` callbacks may return nothing and expose
  their `globalThis` receiver; `parsePageDictionary()` and `parsePage()` name
  their argument `pageIndex`; and `ByteReaderWithPosition#moveStartPosition()`
  is no longer declared
  [#756](https://github.com/julianhille/MuhammaraJS/issues/756)
  [#760](https://github.com/julianhille/MuhammaraJS/issues/760)
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Declare the `PDFDate` and `PDFTextString` constructors, the `FormXObject`
  content, stream and resources getters, `FontMetrics`, `"center"` coordinates
  for Recipe `comment()` and `annot()`, the `useGivenCoords` option of
  `Recipe#rectangle()`, and the optional arguments of `createPDFTextString()`,
  `startPDFStream()` and `calculateTextDimensions()`
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
  [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
- Report an out-of-range object ID from `PDFReader#getXrefEntry()` and a
  non-path `drawImage()` source with accurate error messages [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Treat `null` options like omitted options in Recipe `circle()`,
  `ellipse()`, `arc()`, `rectangle()`, `text()`, `textDimensions()`,
  `polygon()`, and `line()`, draw nothing for `null` coordinates in `line()`,
  and throw `A polygon needs at least one coordinate pair` from `polygon()`
  without coordinates [#829](https://github.com/julianhille/MuhammaraJS/issues/829)
- Stop `Recipe#polygon()` from appending the closing point to the coordinate
  array the caller passed in [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Keep Recipe `rectangle()` rounded-corner strokes concentric with the fill by
  shrinking corner radii with the stroke inset, draw `ellipse()` strokes as a
  true inset ellipse, and collapse `circle()`, `ellipse()`, `rectangle()`, and
  `arc()` strokes wider than the shape onto it instead of drawing them inverted
  [#743](https://github.com/julianhille/MuhammaraJS/issues/743)
- Stroke the border of a Recipe `rectangle()`, `ellipse()`, `arc()`, `pie()` or
  `polygon()` given both `fill` and `color` in `color`, as `@muhammara/wasm`
  does; it was stroked in the fill color [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
- Fix `Recipe#lineWidth()` to apply its width to subsequent lines, as Wasm
  does [#617](https://github.com/julianhille/MuhammaraJS/issues/617)
- Fix Recipe separation colors: paint them in `circle()`, `line()`, `lineTo()`
  and HTML underline and strike-out lines, which were drawn in black; resolve
  them in every Recipe after the first in a process, where the globally cached
  Separation color space referenced an object that only existed in the first
  PDF; and stop writing a second, unused Separation color space for a
  `colorName` ink when a shape paints a `fill` or `stroke` and no `color`
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
  [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
- Treat an inherited object key such as `constructor` as an unknown Recipe
  color name instead of failing with `color.startsWith is not a function`,
  register any `chroma()` name including `__proto__`, also as a Separation
  ink, and reject a `chroma("!load", file)` file that names `__proto__` as a
  colorspace instead of writing its colors onto `Object.prototype`
  [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
- Keep the text of a Recipe `text()` call with `hilite` on an edited page, and
  draw the first segment of a `line()` on an edited page; both went to a
  content stream that had already ended
  [#799](https://github.com/julianhille/MuhammaraJS/issues/799)
- Fix `Recipe#editPage()` throwing in debug mode, where it loaded the bold
  Helvetica font by an outdated name [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Fix `Recipe#read(inSrc)` reading the Recipe's own Buffer source instead of
  `inSrc`, and failing when `inSrc` is a Buffer [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Apply the Recipe `version` option to new PDFs written to a Buffer; it was
  ignored and those PDFs were always version 1.7 [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Fix Recipe `movedown(lines, true)` throwing a `TypeError` before any text was
  written; it now moves down from the page origin [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Finish an active Recipe page in `endPDF()` and `appendPage()` instead of
  writing a document without it. `createPage()` followed by `endPDF()` wrote a
  PDF with no page tree, and the same sequence with page content or an
  `appendPage()` threw `Unable to end PDF`
  [#732](https://github.com/julianhille/MuhammaraJS/issues/732)
- Keep valid Recipe page numbers when adding pages to an existing document so
  annotations on those pages no longer fail during `endPDF()`
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Lay out Recipe `text()` without a `textBox` in linear time; every word
  re-measured the whole line, so 2 000 characters took about 9 seconds and
  longer text effectively hung the process. Output is unchanged
  [#824](https://github.com/julianhille/MuhammaraJS/issues/824)
- Measure Recipe `textDimensions()` with the `fontSize` alias as well as
  `size`, matching `text()` and `@muhammara/wasm`, instead of silently
  measuring at the 14pt default
  [#733](https://github.com/julianhille/MuhammaraJS/issues/733)
- Fix Recipe HTML text: align it on the width it is drawn at instead of one
  space wider; break lines for `<br />` and uppercase `<BR>` and drop the
  whitespace before a line break; use the `href` attribute for links instead
  of the first attribute; stop `<a>` without attributes from throwing; style
  upper-case tags such as `<B>`, `<U>` and `<UL>`; and give text outside any
  element the default 14pt size instead of throwing when no `size` is given
  [#667](https://github.com/julianhille/MuhammaraJS/issues/667)
  [#704](https://github.com/julianhille/MuhammaraJS/issues/704)
  [#708](https://github.com/julianhille/MuhammaraJS/issues/708)
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Render one correctly indented marker per Recipe list item across
  formatting, block children, nested lists, and explicit line breaks; keep
  internal break artifacts out of layout and clipping; and count indentation
  once during wrapping
  [#661](https://github.com/julianhille/MuhammaraJS/issues/661)
- Create Recipe text-markup annotations only for `highlight`, `underline`,
  `strikeOut`, and `squiggly` options that are enabled, so `false` values no
  longer add an annotation, and extend their bounds across justified lines,
  including the expanded spaces, starting at the drawn line for text with
  `opacity` or `rotation`. The caller's markup options object is no longer
  modified [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Write Recipe annotation `title`, `subject`, contents, and rich text as PDF
  text strings, so non-ASCII characters no longer display as garbled UTF-8
  bytes in PDF viewers. A `0` or `false` title or subject is written as
  `"0"`/`"false"` instead of an empty title, and rich text that starts with
  `<?xml` is written instead of the string `true`
  [#716](https://github.com/julianhille/MuhammaraJS/issues/716)
- Write the `lockedcontents` annotation flag, which the types accepted but
  Recipe wrote as no flag, and write `annot()` subtypes given in another
  casing, such as `"highlight"`, with their PDF name and default markup color
  instead of an invalid lower-case name in black
  [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Measure Recipe `table()` cells with `html: true` as HTML, so a cell with line
  breaks no longer overlaps the next row
  [#667](https://github.com/julianhille/MuhammaraJS/issues/667)
- Stop Recipe `table()` from throwing for empty `contents`, reusing a previous
  table's `overflow` callback, keeping the first page's bounds on a
  continuation, overlapping a continued row with its repeated header, drawing a
  zero-height border for an empty segment, and mutating `border` options.
  An `overflow` callback that ends the page without starting another throws a
  clear `Error` instead of an internal `TypeError`. Inherited record
  properties such as `constructor` are treated as missing cells, callback
  options such as `onClip` set on a table, column, row, or header are kept,
  and a table's `overflow` callback no longer also runs as the text-flow
  overflow callback of a cell
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666)

### Changed

- Update the vendored zlib from 1.2.11 to 1.3.1, which carries the upstream
  fixes for CVE-2018-25032 in `deflate()` and CVE-2022-37434 in
  `inflateGetHeader()`. Flate streams decode to the same bytes as before; the
  compressed bytes of written PDFs may differ from 6.x output [#862](https://github.com/julianhille/MuhammaraJS/issues/862)
- Update the bundled IJG libjpeg from 9d (2020) to 10 (2026), which decodes
  `DCTDecode` streams read from PDFs [#866](https://github.com/julianhille/MuhammaraJS/issues/866)
- Update the bundled PDF-Writer to 4.9.1
  [#534](https://github.com/julianhille/MuhammaraJS/issues/534)
- Set the `Creator` Info entry that `Recipe` writes to
  `Muhammara-Recipe (https://github.com/julianhille/MuhammaraJS)`, replacing
  the inherited `Hummus-Recipe` value. PDFs edited with `Recipe` still record
  the source document's own creator as `source-Creator`.
- Throw a `TypeError` that reads "No page is active; call createPage() or
  editPage() first" from Recipe drawing and annotation methods called without
  a page, instead of a property-destructuring `TypeError` [#792](https://github.com/julianhille/MuhammaraJS/issues/792)
- Make Recipe `register()`, `pauseContext()`, and `resumeContext()`
  chainable [#608](https://github.com/julianhille/MuhammaraJS/issues/608)
- Collect the output of a Buffer-mode `Recipe` with the bundled
  `PDFWStreamForBuffer` instead of the unmaintained `memory-streams` package,
  which drops that dependency and its five transitive packages
- Link `bcrypt.lib` explicitly in the Windows native build, where OpenSSL seeds
  AES initialization vectors from `BCryptGenRandom`
  [#663](https://github.com/julianhille/MuhammaraJS/issues/663)
- Build Linux prebuilds against the Debian archive now that Debian 11
  bullseye is end of life [#577](https://github.com/julianhille/MuhammaraJS/issues/577)
- Build and test the macOS arm64 binaries natively on Apple Silicon instead of
  cross-compiling them from an x64 Node.js, so every arm64 prebuild is
  executed before it ships [#695](https://github.com/julianhille/MuhammaraJS/issues/695)
- Build seven canonical native prebuilds and reuse them across the supported
  Node.js and Electron compatibility tests, including native ARM64 musl tests,
  and force the packaged-source Electron rebuild check to compile from source
  [#603](https://github.com/julianhille/MuhammaraJS/issues/603)
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750)
- Publish all three native npm packages before creating the GitHub release,
  upload the release prebuilds first, let a re-run on an existing tag finish a
  partial release, and mark prerelease GitHub releases as pre-releases
  [#684](https://github.com/julianhille/MuhammaraJS/issues/684)
  [#696](https://github.com/julianhille/MuhammaraJS/issues/696)
- Validate that the native GYP and Wasm CMake builds compile the same
  PDFWriter translation units [#684](https://github.com/julianhille/MuhammaraJS/issues/684)
- Speed up native source builds with parallel compilation and ccache-backed CI
  caches [#562](https://github.com/julianhille/MuhammaraJS/issues/562)
- Update GitHub Actions to their current releases to remove deprecated Node.js
  action runtimes [#700](https://github.com/julianhille/MuhammaraJS/issues/700)
- Drop the Node.js compatibility fallbacks in `src/nodes.h` for versions below
  the supported floor [#553](https://github.com/julianhille/MuhammaraJS/issues/553)
- Add regression coverage for `retrieveJPGImageInformation`, the `compress`
  writer option, and the low-level `ri`, `i`, `gs`, `CS`, `cs`, `SC`, `SCN`,
  `sc`, and `scn` operators, closing test-parity gaps against
  `@muhammara/wasm` [#725](https://github.com/julianhille/MuhammaraJS/issues/725)
- Document the complete set of Perl packages RPM-based distributions need for
  a source build [#596](https://github.com/julianhille/MuhammaraJS/issues/596)
- Rework the npm READMEs of `@muhammara/native`, `@muhammara/native-with-source`,
  and `@muhammara/native-core`: each explains how the MuhammaraJS packages fit
  together, when to use the Wasm package instead, supported platforms, and
  tested quick-start examples [#772](https://github.com/julianhille/MuhammaraJS/issues/772)

## [6.0.6] - 2026-08-22

### Fixed

- Update the tar override to 7.5.22 for security vulnerability fixes.
- Use the lockfile's Prettier version in the CI lint job.
- Update brace-expansion to 2.1.4 for security vulnerability fixes.
- Update diff to 5.2.2 for security vulnerability fixes.
- Update js-yaml to 4.3.1 for security vulnerability fixes.
- Update linkify-it to 5.0.2 for security vulnerability fixes.
- Update lodash to 4.18.1 for security vulnerability fixes.
- Update markdown-it to 14.3.0 for security vulnerability fixes.
- Update picomatch to 2.3.2 for security vulnerability fixes.
- Update underscore to 1.13.8 for security vulnerability fixes.
- Default missing Crypt filter parameters to Identity to fix GHSA-ch7g-v45m-q27g and GHSA-7xrh-8x56-r797.

## [6.0.5] - 2026-05-21

### Fixed

- Update xmldom to 0.9.10 to address cve issue
- Update node-tar to 7.5.15 to address cve issue
- Update minimatch to 9.0.9 to address cve issue
- Fix GHSA-fhp4-pr5j-46m5 DOS issue in PDF Writer

## [6.0.4] - 2026-02-25

### Fixed

- Raise node-tar override to 7.5.9 for the recurring security vulnerability fix.

## [6.0.3] - 2026-01-29

### Fixed

- Update tar version to 7.5.7 in overrides for security vulnerability fix.

## [6.0.2] - 2026-01-22

### Fixed

- Missing package update to the tar overrides to finally fix the vulnaribility.

## [6.0.1] - 2026-01-21

DEPRECATED.

This version does not fix the tar vulnaribility as it misses
the package-lock.json update and so will be replaced with 6.0.2

### Fixed

- Force tar to >=7.5.4 to fix security vulnaribility by removing
  npm dependency and updating node-pre-gyp to compatible version

## [6.0.0] - 2025-09-23

### Added

- Current supported electron versions (36.x, 37.x, 38.x)

### Removed

- Outdated and EOL versions of nodejs (17, 18)
- All electron versions current supported editions (<36.x>)

### Fixed

- Update node-pre-gyp and brace to remove security concerns
- Update npm version to support newer node-pre-gyp

## [5.4.0] - 2025-09-21

### Added

- Add node v24.0.0

## [5.3.0] - 2024-12-14

### Added

- Add electron 31.7.0, 33.1.0, 33.2.0, 33.3.0 [#439](https://github.com/julianhille/MuhammaraJS/issues/439)

### Fixed

- Fix recipe with new buffers [#372](https://github.com/julianhille/MuhammaraJS/issues/372)
- Wrong node versions for 2.2, 32.1 and 31.6 [#439](https://github.com/julianhille/MuhammaraJS/issues/439)
- Fix recipes createPage typescript definition and jsdoc, discourage
  use of '-size' values for pageType [#369](https://github.com/julianhille/MuhammaraJS/issues/369)

## [5.2.0] - 2024-10-20

### Added

- Add electron 33.0, 32.1, 32.2, 31.5, 31.6, 30.5

## [5.1.0] - 2024-10-17

### Added

- Add node v23.0.0

### Updated

- Downgrade to gcc11 to lower needed glibc version

## [5.0.2] - 2024-10-10

### Added

- Update PDRWriter to 4.6.7 (#410)

### Update

- Build linux on docker -> downgrade glibc for linux builds (#423)

## [5.0.1] - 2024-09-28

### Added

- Tests for bold, italic, underline, strikethrough, and highlights in textboxes
- Add missing node v21 and v22 to the build matrix (#417)

## [5.0.0] - 2024-09-08

### Added

- Add electron 24.7 and 24.8
- Add electron 25.4, 25.5, 25.6, 25.7, 25.8 and 25.9
- Add electron 26.0, 26.1, 26.2, 26.3, 26.4, 26.5, 26.6
- Add electron 27.0, 27.1, 27.2 and 27.3
- Add electron 28.0, 28.1, 28.2 and 28.3
- Add electron 29.0, 29.1, 29.2, 29.3 and 29.4
- Add electron 30.0, 30.1, 30.2, 30.3 and 30.4
- Add electron 31.0, 31.1, 31.2, 31.3 and 31.4
- Add electron 32.0
- Add node v22.0.0

### Remove

- Outdated electron 23.x versions
- Node version <= 16

### Update

- Update dependencies
  - Including tar which removes a security vulnerability
- new Buffer to Buffer.from

## [4.1.0] - 2023-12-13

### Fixed

- definitions: appendPage optionnal parameter
- Build musl/musl-arm with node 20
- Support negative rotation in recipe page changes
- registerFont now returns recipe as stated in typescript definition

### Added

- Add nodejs v21.0.0

## [4.0.0] - 2023-07-14

### Fixed

- Recipe type / arg documentation
- Add missing type `userPassword` to `EncryptOptions`
- Underline in text object

### Added

- Add electron 23.2., 23.3
- Recipe infos to readme
- Strikethrough implementation in text object
- Electron v24.1, 24.2, 24.3, 24.4, 24.5, 24.6
- Add node 20.x
- Add electron v25.0, 25.1, 25.2, 25.3
- Option to add annotation replies to annotations
- Textboxes now show title and date as annotations in pdfs

### Removed

- Dependency to static-eval and static-module as they are not used directly
- Node versions: 11.x - 14.x
- Electron versions: 11.x - 14.2

### Changed

- Updated node-gyp version to 1.0.10
- Older node ubuntu 18.04 builds are now building on docker, as github actions removed 18.04
- CI linux builds use ubuntu 20.04 instead of 18.04 -> glibc Update, see readme for breaking changes in v4

## [3.8.0] - 2023-03-01

### Added

- Electron 22.3, 23.0.0, 23.1.1

### Fixed

- Correctly includes types file in package

## [3.7.0] - 2023-02-09

### Added

- Electron 21.4, 22.1 and 22.2

### Fixed

- Update xmldom to new 0.8.6 and fix security issues
- Fix arm64 on mac builds

### Removed

- Pre-builts for macos on arm for node < 15 (eg 14, 12, 10 etc)

## [3.6.0] - 2023-01-24

### Added

- Pre builts for arm64 / musl architecture (M1 using alpine)
- Hummus-recipe / Muhammara-recipe as part of this lib

### Fixed

- Memory leak in ByteReaderWithPositionDriver when reading PDF files

## [3.5.0] - 2022-12-07

### Added

- Electron 22.0.x

## [3.4.0] - 2022-11-24

### Added

- Electron 21.3.x

### Fixed

- Several cases of NPE under different circumstances

## [3.3.0] - 2022-11-05

### Fixed

- Typescript definition of member buffer of PDFWStreamForBuffer fixed

### Changed

- Updated github actions to get rid of some deprecation warnings in gha ci
- Pin python 3 version for builds

### Added

- Electron 21.0.0, 21.1.0 and 21.2.0

## [3.2.0] - 2022-10-26

### Added

- Add electron 20.3.3
- Ignore extra data above the header and below the footer in PDF Parser
- Add node 19.0.0

## [3.1.1] - 2022-10-23

### Fixed

- NPE in parser when file ends before it really starts

## [3.1.0] - 2022-09-30

### Changed

- Update TypeScript declaration for `PDFStreamForResponse` to accept any writable stream as an argument, not just `PDFRStreamForFile`

### Added

- Electron 21.0
- Node 18
- Electron 20.0, 20.1, 20.2
- Prettier as dev dependency and basics
- Electron 19.1

## [3.0.0] - 2022-07-19

### Fixed

- Links in docs

### Added

- drawPath can now be used differently and this new way can be described with ts.
  The old style is `drawPath(x1, y1, x2, y2..., options)` we now allow `drawPath([[x1, y1], [x2, y2]...], options)` too
- scn and SCN can now be used differently and this new way can be described with ts.
  The old style is `scn(c1, c2, c3, c4, ..., 'patternName')` we now allow `scn([[c1, c2, c3, c4, ...], 'patternName')` too

### Changed

- Bump dev dependency versions s

### Breaking

- Node < 11 and Electron < 11 removed
- Renamed typo exported value from eTokenSeprator to eTokenSeparator

## [2.6.2] - 2022-11-23

### Fixed

- Several cases of NPE under different circumstances

## [2.6.1] - 2022-10-23

### Fixed

- Backport: NPE in parser when file ends before it really starts

## [2.6.0] - 2022-06-30

### Changed

- Fixes hard crash to exception when creating a stream with null object and calling createWriter with it
- Fixes missing buffer information for recrypt typescript definition
- Fixes missing options for append pdf pages
- Fixes NPE when stream is not readable in write stream object (PDFDocumentHandler)

## [2.5.0] - 2022-06-23

### Added

- Electron 17.2.0, 17.3, 17.4
- Typescript definitions
- Add test for recrypt with streams

## [2.4.0] - 2022-06-08

### Added

- Electron 18.1, 18.2, 18.3
- Electron 19.0

### Changed

- Update npm dist url to the new url for electron builds

## [2.3.0] - 2022-05-04

### Added

- Builds for node and electron with arm64 on darwin (Apple M1)
- Add electron 18

## [2.2.0] - 2022-03-05

### Changed

- Update PDFWriter dependency to the newest available versoin

### Added

- Electron version: 17.0, 17.1
- NodeJs 17.6.0

## [2.1.0] - 2021-12-03

### Added

- Electron versions: 16.0, 15.3, 15.2, 14.2, 13.6, 13.3

## [2.0.0] - 2021-10-22

### Removed

- Electron 2.0.7
- Node 6.14.1 and 7.10.1

### Added

- Add Electron 13.3.0
- Documentation (copy of the wiki)
- Add Electron 13.2.3
- Add Electron 13.5.0
- Add Electron 14.0.1
- Add Electron 14.1.0
- Add Electron 15.0.0
- Add Electron 15.1.2
- Add Node 16.11.1

### Fixed

- Dependency to node-pre-gyp moved from deprecated to scoped package

## [1.10.0] - 2021-07-12

### Added

- Add Electron 13.1
- Disable NEON on arm builds

## [1.9.0] - 2021-06-30

### Fixed

- Yarn v2 incompatibiliy
- Build issues on mac OS big sur

## [1.8.0] - 2021-05-28

### Added

- Add Electron 13.0
- Add missing typescript declaration of the PDFWStreamForBuffer
- Add Electron 11.4
- Add electron 10.4

## [1.7.0] - 2021-03-08

### Added

- More electron 11.x releases
- Add electron 12.0.0
- Add electron 10.2, 10.3
- Add electron 9.4, 9.3

## [1.6.0] - 2021-02-17

### Fixed

- Update the g++ compiler from 4.8 to 5.4 (default on xenial) for linux builds
- Changed builds from travis and app veyor to github

### Added

- Electron 11
- Added Node 15

## [1.5.1] - 2020-10-10

### Added

- Added manual workflow to reduce release errors

### Fixed

- Huge package size as npm publish does not use .gitignore or .npmignore locally

## [1.5.0] - 2020-10-10

### Added

- Electron 7.3, 8.3, 8.4, 8.5 and 9.3

## [1.4.3] - 2020-10-09

### Fixed

- Return code fixed for builds on app veyor.
- Winwdows builds successfully with electron 10.x
- NPM version on app veyor fixed to build electron 2.x again

### Added

- Add electron 10.1.3

## [1.4.2] - 2020-08-27

### Added

- Add electron 10.0

## [1.4.1] - 2020-08-13

This is a special release no code has been changed.
The packaged module included (in version muhammara@1.4.0) a bundled dependency with a
debug output.

### Fixed

- Removed debug output from packaged dependency `node-pre-gyp`

## [1.4.0] - 2020-08-10

### Added

- Add electron 9.2

## [1.3.0] - 2020-08-06

### Added

- Add electron-9.1 pre built

### Fixed

- Add missing typescript declaration files to published packages

## [1.2.0] - 2020-06-01

### Fixed

- Updated freetype to 2.10.0
- Updated libpng dependency to 1.6.37
- Updated libaesgm dependency
- Update libjpeg dependency to 9d
- Updated libtiff dependency to 3.9.7

## [1.1.0] - 2020-05-27

### Added

- Added infos about being hummusjs drop in replacement
- Added electron v9.0.0

### Fixed

- Updated dependencies and dev dependencies

## [1.0.1] - 2020-05-08

### Fixed

- Fixed readme to include infos about muhammaraJS and hummus
- Fixed node-pre-gyp binary download links

### Removed

- Unecessary dependency on aws-sdk

## [1.0.0] - 2020-05-07

Basically this is [HummusJS v1.0.108](https://github.com/galkahana/HummusJS/commit/772bd561f02433bf1a602135f53c7c17f8072450)
with the following changes.

### Added

- Store releases @github
- Listen for tags instead of a commit message
- Added node v13, v14, electron 6.1, 7.1, 7.2, 8.0, 8.1, 8.2

### Fixed

- Updated v8:GET / v8:SET calls which are incompatible with newer node version (>13)

### Removed

- Dropped support for electron 1.8

- Initial release

[unreleased]: https://github.com/julianhille/MuhammaraJS/compare/native-v7.0.0...HEAD
[7.0.0]: https://github.com/julianhille/MuhammaraJS/compare/6.0.6...native-v7.0.0
[6.0.6]: https://github.com/julianhille/MuhammaraJS/compare/6.0.5...6.0.6
[6.0.5]: https://github.com/julianhille/MuhammaraJS/compare/6.0.4...6.0.5
[6.0.4]: https://github.com/julianhille/MuhammaraJS/compare/6.0.3...6.0.4
[6.0.3]: https://github.com/julianhille/MuhammaraJS/compare/6.0.2...6.0.3
[6.0.2]: https://github.com/julianhille/MuhammaraJS/compare/6.0.1...6.0.2
[6.0.1]: https://github.com/julianhille/MuhammaraJS/compare/6.0.0...6.0.1
[6.0.0]: https://github.com/julianhille/MuhammaraJS/compare/5.4.0...6.0.0
[5.4.0]: https://github.com/julianhille/MuhammaraJS/compare/5.3.0...5.4.0
[5.3.0]: https://github.com/julianhille/MuhammaraJS/compare/5.2.0...5.3.0
[5.2.0]: https://github.com/julianhille/MuhammaraJS/compare/5.1.0...5.2.0
[5.1.0]: https://github.com/julianhille/MuhammaraJS/compare/5.0.2...5.1.0
[5.0.2]: https://github.com/julianhille/MuhammaraJS/compare/5.0.1...5.0.2
[5.0.1]: https://github.com/julianhille/MuhammaraJS/compare/5.0.0...5.0.1
[5.0.0]: https://github.com/julianhille/MuhammaraJS/compare/4.1.0...5.0.0
[4.1.0]: https://github.com/julianhille/MuhammaraJS/compare/4.0.0...4.1.0
[4.0.0]: https://github.com/julianhille/MuhammaraJS/compare/3.8.0...4.0.0
[3.8.0]: https://github.com/julianhille/MuhammaraJS/compare/3.7.0...3.8.0
[3.7.0]: https://github.com/julianhille/MuhammaraJS/compare/3.6.0...3.7.0
[3.6.0]: https://github.com/julianhille/MuhammaraJS/compare/3.5.0...3.6.0
[3.5.0]: https://github.com/julianhille/MuhammaraJS/compare/3.4.0...3.5.0
[3.4.0]: https://github.com/julianhille/MuhammaraJS/compare/3.3.0...3.4.0
[3.3.0]: https://github.com/julianhille/MuhammaraJS/compare/3.2.0...3.3.0
[3.2.0]: https://github.com/julianhille/MuhammaraJS/compare/3.1.1...3.2.0
[3.1.1]: https://github.com/julianhille/MuhammaraJS/compare/3.1.0...3.1.1
[3.1.0]: https://github.com/julianhille/MuhammaraJS/compare/3.0.0...3.1.0
[3.0.0]: https://github.com/julianhille/MuhammaraJS/compare/2.6.2...3.0.0
[2.6.2]: https://github.com/julianhille/MuhammaraJS/compare/2.6.1...2.6.2
[2.6.1]: https://github.com/julianhille/MuhammaraJS/compare/2.6.0...2.6.1
[2.6.0]: https://github.com/julianhille/MuhammaraJS/compare/2.5.0...2.6.0
[2.5.0]: https://github.com/julianhille/MuhammaraJS/compare/2.4.0...2.5.0
[2.4.0]: https://github.com/julianhille/MuhammaraJS/compare/2.3.0...2.4.0
[2.3.0]: https://github.com/julianhille/MuhammaraJS/compare/2.2.0...2.3.0
[2.2.0]: https://github.com/julianhille/MuhammaraJS/compare/2.1.0...2.2.0
[2.1.0]: https://github.com/julianhille/MuhammaraJS/compare/2.0.0...2.1.0
[2.0.0]: https://github.com/julianhille/MuhammaraJS/compare/1.10.0...2.0.0
[1.10.0]: https://github.com/julianhille/MuhammaraJS/compare/1.9.0...1.10.0
[1.9.0]: https://github.com/julianhille/MuhammaraJS/compare/1.8.0...1.9.0
[1.8.0]: https://github.com/julianhille/MuhammaraJS/compare/1.7.0...1.8.0
[1.7.0]: https://github.com/julianhille/MuhammaraJS/compare/1.6.0...1.7.0
[1.6.0]: https://github.com/julianhille/MuhammaraJS/compare/1.5.1...1.6.0
[1.5.1]: https://github.com/julianhille/MuhammaraJS/compare/1.5.0...1.5.1
[1.5.0]: https://github.com/julianhille/MuhammaraJS/compare/1.4.3...1.5.0
[1.4.3]: https://github.com/julianhille/MuhammaraJS/compare/1.4.2...1.4.3
[1.4.3]: https://github.com/julianhille/MuhammaraJS/compare/1.4.2...1.4.3
[1.4.3]: https://github.com/julianhille/MuhammaraJS/compare/1.4.2...1.4.3
[1.4.2]: https://github.com/julianhille/MuhammaraJS/compare/1.4.1...1.4.2
[1.4.1]: https://github.com/julianhille/MuhammaraJS/compare/1.4.0...1.4.1
[1.4.0]: https://github.com/julianhille/MuhammaraJS/compare/1.3.0...1.4.0
[1.3.0]: https://github.com/julianhille/MuhammaraJS/compare/1.2.0...1.3.0
[1.2.0]: https://github.com/julianhille/MuhammaraJS/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/julianhille/MuhammaraJS/compare/1.0.1...1.1.0
[1.0.1]: https://github.com/julianhille/MuhammaraJS/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/julianhille/MuhammaraJS/tree/1.0.0
