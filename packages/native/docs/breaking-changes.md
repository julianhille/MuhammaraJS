# Breaking Changes

This page collects the compatibility changes formerly maintained in the README.
For release-by-release changes, see the [Changelog](https://github.com/julianhille/MuhammaraJS/blob/develop/CHANGELOG.md).

## Version 7.x

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
