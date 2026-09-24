# Breaking Changes

This page collects the compatibility changes formerly maintained in the README.

## Version 7.x

- `appendPDFPagesFromPDF()` now ends its writer when appending fails. Previously
  callers could continue and produce a corrupted document; create a fresh
  writer and retry with a valid source.
- Custom-stream `getCurrentPosition()` results now throw `TypeError` if numeric
  conversion produces a non-finite value or a value outside `[-2^63, 2^63)`.
  Previously these values could produce corrupt PDF offsets. Return the actual
  finite byte position within that range. Numeric strings and other successful
  number coercions remain supported. See the
  [stream contract](low-level/custom-streams.md)
  [#750](https://github.com/julianhille/MuhammaraJS/issues/750).
- Low-level shape helpers now honor `type: "clip"`, ending the path with `W n`
  without painting it. Previously `"clip"` did nothing and unrecognized types
  incorrectly clipped. Unknown types now end the path without painting. Use `"clip"` explicitly and scope it with `q()`/`Q()`;
  use `"stroke"` or `"fill"` when painting is intended. See the
  [drawing migration](getting-started/migrate-from-v6.md#15-check-low-level-clipping-options).
- Shape helpers and `writeText()` now finish input conversion before emitting
  operators. Failed getters or coercions no longer leave partial graphics/text
  output; correct the input and retry rather than relying on that partial output.
  Coordinates, dimensions, stroke widths, and text sizes must convert to finite
  numbers; calculated circle and underline geometry must also remain finite.
  `drawPath()` requires at least two complete pairs and rejects malformed or
  extra arguments instead of drawing a prefix. Replace `NaN`/infinities with
  finite values, reduce overflowing geometry, and supply complete pairs. See
  the [drawing migration](getting-started/migrate-from-v6.md#15-check-low-level-clipping-options).
- Native prebuilds now use Node-API 8 and are named
  `napi-v8-{platform}-{arch}-{libc}.tar.gz` instead of
  `node-v{abi}-{platform}-{arch}-{libc}.tar.gz`. The installed addon now lives
  at `binding/napi-v8/muhammara.node` instead of
  `binding/muhammara.node`. Standard npm installs and
  `require("@muhammara/native")` calls continue to work, but custom mirrors,
  direct archive downloads, deployment scripts, and direct addon imports that
  assume the old names or path must use the Node-API names instead. See
  [Migrate from v6 to v7](getting-started/migrate-from-v6.md#14-update-native-binary-tooling)
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
  [Migrate from v6 to v7](getting-started/migrate-from-v6.md#12-choose-table-columns-explicitly)
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666).
- Recipe table sizing includes vertical padding, minimum/fixed cell heights,
  and rendered HTML. Rows can grow taller and continue earlier; adjust the cell
  sizing or continuation area. If an `overflow` callback continues into an
  area too small for the pending row and repeated header, `table()` now throws
  `RangeError` instead of drawing beyond the bounds. Return `true` to stop or
  provide enough space; see the
  [table migration steps](getting-started/migrate-from-v6.md#12-choose-table-columns-explicitly)
  [#666](https://github.com/julianhille/MuhammaraJS/issues/666).
- Native Recipe character-spacing measurements now count leading and trailing
  non-breaking spaces, matching Wasm. Text using `charSpace` can measure wider
  or wrap earlier; replace boundary U+00A0 characters with regular spaces when
  they should be trimmed from spacing calculations.
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
- Recipe `endPage()` no longer leaves the completed page active. Code that
  calls page drawing, configuration, or context methods after `endPage()` now
  fails instead of reusing the completed page and its content context; call
  `createPage()` or `editPage()` before the next page operation. See
  [Migrate from v6 to v7](getting-started/migrate-from-v6.md#9-reactivate-pages-after-endpage).
- Recipe `appendPage()` rejects zero, negative, fractional, reversed, and
  malformed page selections. These values were previously clamped, passed to
  the low-level writer, or partially interpreted; pass positive one-based
  integers or ascending two-value ranges instead. Integer endpoints beyond the
  source still clamp to its final page.
- Recipe `insertPage()` throws `TypeError` immediately when `pdfSrc` or
  `srcPageNumber` is missing. Incomplete calls previously queued no insertion or
  failed later during `endPDF()`; pass `afterPageNumber`, `pdfSrc`, and the
  positive one-based `srcPageNumber` together.
- Recipe `pauseContext()` and `resumeContext()` throw when there is no matching
  active or paused page content context. Calls outside a page lifecycle and
  repeated pause or resume calls used to do nothing silently; call
  `pauseContext()` only after creating or editing a page, and call
  `resumeContext()` exactly once after a successful pause.
- The undocumented native `Recipe` prototype members `ANNOTATION_PREFIX`,
  `appendPDFPageFromPDFWithAnnotations()`, and
  `appendPDFPagesFromPDFWithAnnotations()` were removed. Code that called them
  now fails because they were internal helpers, not Recipe APIs; use
  `appendPage()`, `insertPage()`, or `split()` for supported page-copying
  operations.
- `PDFReader` methods that take a page index or object ID — `parseNewObject()`,
  `getPageObjectID()`, `parsePageDictionary()`, `parsePage()`,
  `extractPageText()`, `extractPageContentItems()`, and `getXrefEntry()` —
  reject anything that is not a non-negative integer below 2^32. Negative,
  fractional, `NaN`, `Infinity`, and out-of-range arguments used to be coerced
  silently, so `reader.parsePage(-1)` read page 4294967295 and
  `reader.extractPageText(1.5)` read page 1; they now throw
  `TypeError: Page index must be a non-negative integer` (or
  `Object ID must be a non-negative integer`). Round or validate the value
  before passing it, bounding page indices with `getPagesCount()` and object IDs
  with `getObjectsCount()`.
- `Recipe.setPageBox()` now accepts `ePDFPageBox*` constants rather than string
  names. `recipe.setPageBox("crop", ...)` now throws; replace the string with
  `muhammara.ePDFPageBoxCropBox`. See [Migrate from v6 to v7](getting-started/migrate-from-v6.md#7-update-recipe-page-boxes).
- `Recipe.fillOpacity()` was removed. Existing calls now throw because it is no
  longer a Recipe method; use `Recipe.opacity()` to set both fill and stroke
  alpha. Opacity persists for later vector drawing, so call `opacity(1)` to
  restore opaque output. See [Migrate from v6 to v7](getting-started/migrate-from-v6.md#8-replace-recipefillopacity).
- Native Recipe TypeScript declarations now use named callback and option types
  for `register()`, `layout()`, and `table()`, finite colorspace values, and
  shape-specific polygon, arrow, and triangle options. Code that passed a value
  typed as `Function`, used `object[]` rows or unknown table fields, returned
  unsupported values from text or table callbacks, relied on widened vector
  line styles and rotation origins, or used broad strings for documented finite
  values may now fail `tsc`; annotate those values with the corresponding
  `muhammara.Recipe` types, return documented callback instructions, annotate
  arrow dimensions and triangle definitions with fixed-length tuples, and omit
  unsupported shape values to retain runtime defaults. See
  [Migrate from v6 to v7](getting-started/migrate-from-v6.md#10-update-recipe-types)
  [#654](https://github.com/julianhille/MuhammaraJS/issues/654).
- `Recipe.metadata` now declares the two optional counters the runtime uses: a
  document read from a file has `pages`, while a document created from scratch
  has `pageCount`. `recipe.metadata.pages` is therefore `number | undefined`,
  not always `number`. Code that read it unconditionally now fails `tsc`; check
  that `recipe.metadata.pages !== undefined`, or use the return value of
  `read()`, which is typed `ReadMetadata` directly.
  See [Migrate from v6 to v7](getting-started/migrate-from-v6.md#10-update-recipe-types)
  [#654](https://github.com/julianhille/MuhammaraJS/issues/654).
- The unscoped `muhammara` package is deprecated and receives no further
  releases. Install `@muhammara/native` instead, or use an npm alias when an
  existing `require("muhammara")` import must remain unchanged. See
  [Install as an npm alias](getting-started/installation.md#install-as-an-npm-alias).
- `@muhammara/native` is prebuilt-only. When a matching prebuilt is unavailable,
  installation fails instead of compiling locally; install
  `@muhammara/native-with-source` for bundled source and fallback builds.
- `@muhammara/native-core` is the shared runtime dependency of both implementation
  packages. Install `@muhammara/native` or `@muhammara/native-with-source`; do not
  replace an application import with `@muhammara/native-core`.
- Windows win32 (32-bit) prebuilds and build tooling were removed. Windows x64
  is the current prebuilt target; Windows arm64 is not part of the prebuilt
  matrix.
- Recipe requires a text `size`, or its `fontSize` alias, greater than zero and
  throws `RangeError` naming the option and the value otherwise. `text()`
  previously clamped a negative size to 1pt, drew nothing visible for zero, and
  `textDimensions()` measured with those values, returning nonsensical metrics
  such as a width of 2147483645.5 for `size: -5`. Zero and `NaN` previously fell
  back to the 14pt default in some paths, hiding the mistake. Pass a size
  greater than zero, or omit the option — `null` and `undefined` still select
  the 14pt default. See
  [Migrate from v6 to v7](getting-started/migrate-from-v6.md#13-pass-a-text-size-greater-than-zero)
  [#733](https://github.com/julianhille/MuhammaraJS/issues/733).

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
