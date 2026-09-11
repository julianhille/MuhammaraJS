# Changelog

All notable changes to `@muhammara/wasm` are documented in this file.

## [Unreleased]

### Added

- Support chainable Recipe `pauseContext()` and `resumeContext()` transitions
  on newly created pages while retaining errors for unmatched calls
  [#608](https://github.com/julianhille/MuhammaraJS/issues/608)
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

### Fixed

- Align Recipe text, measurement, and layout defaults on 14 points to match
  native, correcting the 12-point default in the alpha and beta releases
  [#605](https://github.com/julianhille/MuhammaraJS/issues/605)

### Changed

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

[Unreleased]: https://github.com/julianhille/MuhammaraJS/compare/wasm-v1.0.0-beta.1...HEAD
[1.0.0-beta.1]: https://github.com/julianhille/MuhammaraJS/compare/wasm-v1.0.0-alpha.1...wasm-v1.0.0-beta.1
[1.0.0-alpha.1]: https://github.com/julianhille/MuhammaraJS/releases/tag/wasm-v1.0.0-alpha.1
