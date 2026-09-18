# Changelog

All notable changes to `@muhammara/wasm` are documented in this file.

## [Unreleased]

### Added

- Add Recipe `text()` options `underline`, `strikeOut`, and `squiggly` as
  structured text-markup annotations alongside `highlight`, with per-annotation
  `text`, `color`, `opacity`, and `replies`, shared `title`, `date`, `subject`,
  `open`, `richText`, `flag`, and `icon`, one annotation per drawn line, on new
  and edited pages. `underline` and `strikeOut` keep drawing their visible line
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)

### Fixed

- Stop corrupting the page content stream when a Recipe page has both drawn
  content and an annotation, such as `comment()`, `annot()`, or a text
  `highlight`; annotations are now written after the content stream is closed
  [#703](https://github.com/julianhille/MuhammaraJS/issues/703)
- Inherit parent annotation metadata for replies without their own `title`,
  `subject`, `date`, `flag`, `open`, or icon, matching native. A reply keeps
  its own contents, rich-text mode, and opacity (opaque by default)
  [#717](https://github.com/julianhille/MuhammaraJS/issues/717)
- Draw `underline` and `strikeOut` text decoration on edited pages, not only on
  new pages [#665](https://github.com/julianhille/MuhammaraJS/issues/665)

### Changed

- Align the Recipe declarations with native: generic `RecipeExtension`
  callbacks and `register()` overloads, `table<RecordType>()` with typed
  columns, `order`, and per-column `renderer` values, numeric `layout()`
  `columns`, finite arrow `type`, `head`, and `shaft` values, and native
  triangle trait, position, and vertex overloads
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)
- Type drawing, text, and `chroma()` color spaces as the new
  `RecipeDeviceColorSpace`, so Separation colors, which WebAssembly Recipe
  rejects at runtime, now fail type checking
  [#665](https://github.com/julianhille/MuhammaraJS/issues/665)

## [1.0.0-beta.3] - 2026-09-18

### Added

- Declare and document the `wasmBinary` loading option, which instantiates the
  module from caller-supplied `Uint8Array` or `ArrayBuffer` bytes without
  fetching the binary, and reject other inputs with a `TypeError`
  [#702](https://github.com/julianhille/MuhammaraJS/issues/702)

### Fixed

- Deploy the browser example on a release tag when the `gh-pages` branch does
  not exist yet. The already-deployed check treated a missing branch as a
  completed deployment, skipping the `mike deploy` that creates the branch and
  then failing the release job when it checked that branch out
  [#690](https://github.com/julianhille/MuhammaraJS/issues/690)
- Create the GitHub release before publishing to npm, and skip the publish when
  the registry already serves the tagged version, so a re-run on an existing tag
  completes instead of failing
  [#696](https://github.com/julianhille/MuhammaraJS/issues/696)
- Mark alpha, beta, and release candidate GitHub releases as pre-releases
  [#696](https://github.com/julianhille/MuhammaraJS/issues/696)

## [1.0.0-beta.2] - 2026-09-14

### Added

- Publish versioned executable browser examples to GitHub Pages for `develop`
  and release builds
  [#690](https://github.com/julianhille/MuhammaraJS/issues/690)
- Support chainable Recipe `pauseContext()` and `resumeContext()` transitions
  on newly created pages while retaining errors for unmatched calls
  [#608](https://github.com/julianhille/MuhammaraJS/issues/608)
- Add native-style visual rendering for unordered, ordered, nested, formatted,
  and linked HTML lists in Wasm Recipe
  [#661](https://github.com/julianhille/MuhammaraJS/issues/661)
- Add Recipe URL links for arbitrary areas, rendered text, images, and drawing
  bounds [#614](https://github.com/julianhille/MuhammaraJS/issues/614)
- Add generated behavioral API reference documentation from JSDoc on every
  public Recipe method, with named TypeScript option and result types
  [#652](https://github.com/julianhille/MuhammaraJS/issues/652)
- Add a MkDocs-validated guide index for browser examples
  [#627](https://github.com/julianhille/MuhammaraJS/issues/627)
- Bundle Apache-2.0 Roboto Regular as Recipe's automatic default font, so text,
  text measurement, and tables work without font registration in browsers and
  Workers. Load it through a separate dynamic import; custom `defaultFont` bytes
  or `defaultFont: false` skip the font download, as does the low-level API.
  Make font uploads optional in the browser table example
  [#613](https://github.com/julianhille/MuhammaraJS/issues/613)
- Add Recipe `replaceText()` for replacing literal text in a page content stream
  [#622](https://github.com/julianhille/MuhammaraJS/issues/622)
- Document that Recipe `getPageInfo()` returns document Info metadata, while
  `pageInfo()` and `getCurrentPageInfo()` return page geometry
  [#621](https://github.com/julianhille/MuhammaraJS/issues/621)
- Document Recipe `opacity()` as applying fill and stroke alpha
  [#618](https://github.com/julianhille/MuhammaraJS/issues/618)
- Document Recipe `lineStyle()` option compatibility with native
  [#617](https://github.com/julianhille/MuhammaraJS/issues/617)
- Add third-party notices and security, provenance, and contribution guidance
  for the WebAssembly package [#626](https://github.com/julianhille/MuhammaraJS/issues/626)
- Add chainable Recipe `deletePage()` support for removing one or more pages
  from an existing byte-backed PDF while preserving retained page objects
  [#548](https://github.com/julianhille/MuhammaraJS/issues/548)
- Add byte-first `recrypt()` and Recipe `encrypt()` with native-compatible
  password options, plus the password-change browser example
  [#595](https://github.com/julianhille/MuhammaraJS/issues/595)
- Document watermarking in place with the byte-first Recipe, and how it
  differs from the native package's path-based overwrite
  [#297](https://github.com/julianhille/MuhammaraJS/issues/297)
- Document adding standard and custom Info dictionary metadata, including
  dotted OID keys, to an existing PDF, and the lower-cased read-back, dropped
  custom entries, and stamped provenance that come with it
  [#450](https://github.com/julianhille/MuhammaraJS/issues/450)
- Document editing and removing an annotation that already exists in a PDF,
  including ending the copying context before the writer
  [#385](https://github.com/julianhille/MuhammaraJS/issues/385)
- Add `PDFReader.extractPageContentItems(pageIndex, limits?)` for detecting
  page-marking content operations, matching the Node reader, along with the
  `ePDFPageContentItemText`, `ePDFPageContentItemPath`,
  `ePDFPageContentItemXObject`, and `ePDFPageContentItemShading` constants
  [#275](https://github.com/julianhille/MuhammaraJS/issues/275)
- Document the extraction budget and page-mark detection in the text-position
  guide [#275](https://github.com/julianhille/MuhammaraJS/issues/275)
- Show `extractPageContentItems()` in the low-level browser example
  [#275](https://github.com/julianhille/MuhammaraJS/issues/275)
- Add idempotent `PDFByteReader.dispose()` for immediately releasing Wasm
  decoded, plain-copying, parser, and copying-context stream readers.

### Changed

- Make documentation self-contained by replacing links to tests, implementation
  files, and GitHub releases with local guides and inline explanations
  [#689](https://github.com/julianhille/MuhammaraJS/issues/689)
- Validate that the native GYP and Wasm CMake builds compile the same PDFWriter
  translation units and that the Wasm ABI exports exactly match runtime use
  [#684](https://github.com/julianhille/MuhammaraJS/issues/684)
- Validate that the Wasm npm package contains its JavaScript, WebAssembly,
  declarations, and fonts without development sources or build files
  [#684](https://github.com/julianhille/MuhammaraJS/issues/684)
- Run a Wasm npm publish dry run, then publish the npm package before creating
  the GitHub release so publication failures do not leave orphan releases
  [#684](https://github.com/julianhille/MuhammaraJS/issues/684)
- Replace the monolithic Wasm Recipe guide with focused, byte-first topic pages
  parallel to the native documentation [#649](https://github.com/julianhille/MuhammaraJS/issues/649)
- Document the native-only writer events and Wasm-only `dispose()` methods
  [#624](https://github.com/julianhille/MuhammaraJS/issues/624)
- Document the browser example's grayscale form XObject tab
  [#630](https://github.com/julianhille/MuhammaraJS/issues/630)
- Reject invalid page indices and object IDs in the reader's `getPageObjectID()`
  and `getXrefEntry()`, and reject values of 2^32 and above in every reader
  method that takes an index, so both ends fail the same way [#581](https://github.com/julianhille/MuhammaraJS/issues/581)
- Cache Emscripten compiler output between builds and give each build
  configuration its own build directory, so repeat builds reuse compiled
  objects while sanitizer and normal builds stay separate
  [#568](https://github.com/julianhille/MuhammaraJS/issues/568)
- Clamp `extractPageText()` limits to the built-in ceilings. Callers can still
  tighten the extraction budget, but can no longer raise it above the bound the
  extractor enforces.
- Rename `PDFTextExtractionLimits` to `PDFExtractionLimits`, now shared by both
  extractors. The old name remains as a deprecated alias.
- Reword the limits shape error to `Extraction limits must be an object` so both
  readers report it identically.
- Set the `Creator` Info entry that `Recipe` writes to
  `Muhammara-Recipe (https://github.com/julianhille/MuhammaraJS)`, replacing the
  inherited `Hummus-Recipe` value. PDFs edited with `Recipe` still record the
  source document's own creator as `source-Creator`.

### Removed

- Remove browser example source files from the `@muhammara/wasm` npm package,
  keeping the published package runtime-only; examples remain available on the
  [documentation site](https://muhammarajs-wasm.readthedocs.io/latest/browser-examples/)
  and in the repository [#684](https://github.com/julianhille/MuhammaraJS/issues/684)

### Fixed

- Guard stateful writer methods consistently after `end()`, `dispose()`, or
  failed finalization with `Error("PDF writer has ended")`, matching native;
  asynchronous methods preserve promise rejection semantics
  [#693](https://github.com/julianhille/MuhammaraJS/issues/693)
- Preserve embedded NUL bytes in the Wasm low-level `TJ()`, `Tj()`, `Quote()`,
  and `DoubleQuote()` strings instead of silently truncating each string at the
  first NUL [#683](https://github.com/julianhille/MuhammaraJS/issues/683)
- Reject unsupported PDF 2.0/AES-256 encryption in `recrypt()` with a clear
  WebAssembly limitation error
  [#678](https://github.com/julianhille/MuhammaraJS/issues/678)
- Prevent Wasm text extraction from reporting inline-image payload bytes as
  fabricated page text [#670](https://github.com/julianhille/MuhammaraJS/issues/670)
- Report the correct text-to-page matrix after text-positioning and `cm`
  operations while extracting page text
  [#673](https://github.com/julianhille/MuhammaraJS/issues/673)
- Preserve HTML whitespace, non-breaking spaces, inline layout, and transforms;
  render one marker per list item while matching native wrapping and nesting;
  recover malformed list closures in linear time without retaining void
  elements; measure HTML table cells; apply character spacing across formatted
  runs, scoped to its own text operation so later low-level page text does not
  inherit it and rejecting non-finite `charSpace` values; transform highlights
  and links with their text and source page; and constrain linked text to
  clipped text boxes
  [#661](https://github.com/julianhille/MuhammaraJS/issues/661)
- Align Recipe text, measurement, and layout defaults on 14 points to match
  native, correcting the 12-point default in the alpha and beta releases
  [#605](https://github.com/julianhille/MuhammaraJS/issues/605)
- Retire the byte-first Recipe and rethrow the original error on later
  `endPDF()` calls after a finalization failure, matching native, instead of
  re-entering finalization against an already-destroyed handle
  [#693](https://github.com/julianhille/MuhammaraJS/issues/693)

## [1.0.0-beta.1] - 2026-09-05

### Fixed

- Generate the API reference during Read the Docs builds [#566](https://github.com/julianhille/MuhammaraJS/issues/566)

### Changed

- Skip Wasm package CI for documentation-only changes; Documentation CI
  validates those updates.

## [1.0.0-alpha.1] - 2026-09-04

### Added

- Add browser-safe, byte-first PDF creation, reading, modification, and Recipe
  APIs for browser pages and Workers.
- Add Chrome page and Worker validation, TypeScript declarations, ABI export
  checks, and lifecycle regression coverage.

### Fixed

- Validate Wasm ABI exports, resource ownership, temporary-file cleanup, and
  bounded byte input/output handling.

[Unreleased]: https://github.com/julianhille/MuhammaraJS/compare/wasm-v1.0.0-beta.3...HEAD
[1.0.0-beta.3]: https://github.com/julianhille/MuhammaraJS/compare/wasm-v1.0.0-beta.2...wasm-v1.0.0-beta.3
[1.0.0-beta.2]: https://github.com/julianhille/MuhammaraJS/compare/wasm-v1.0.0-beta.1...wasm-v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/julianhille/MuhammaraJS/compare/wasm-v1.0.0-alpha.1...wasm-v1.0.0-beta.1
[1.0.0-alpha.1]: https://github.com/julianhille/MuhammaraJS/releases/tag/wasm-v1.0.0-alpha.1
