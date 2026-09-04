# Changelog

All notable changes to `@muhammara/wasm` are documented in this file.

## [Unreleased]

### Added

- Add `PDFReader.extractPageContentItems(pageIndex, limits?)` for detecting
  page-marking content operations, matching the Node reader, along with the
  `ePDFPageContentItemText`, `ePDFPageContentItemPath`,
  `ePDFPageContentItemXObject`, and `ePDFPageContentItemShading` constants
  [#275](https://github.com/julianhille/MuhammaraJS/issues/275)

### Changed

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
