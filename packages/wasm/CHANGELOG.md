# Changelog

All notable changes to `@muhammara/wasm` are documented in this file.

## [Unreleased]

### Fixed

- Generate the API reference during Read the Docs builds [#566](https://github.com/julianhille/MuhammaraJS/issues/566)

### Changed

- Skip Wasm package CI for documentation-only changes; Documentation CI
  validates those updates.

## [1.0.0-alpha.0] - 2026-09-02

### Added

- Add browser-safe, byte-first PDF creation, reading, modification, and Recipe
  APIs for browser pages and Workers.
- Add Chrome page and Worker validation, TypeScript declarations, ABI export
  checks, and lifecycle regression coverage.

### Fixed

- Validate Wasm ABI exports, resource ownership, temporary-file cleanup, and
  bounded byte input/output handling.

[Unreleased]: https://github.com/julianhille/MuhammaraJS/compare/wasm-v1.0.0-alpha.0...HEAD
[1.0.0-alpha.0]: https://github.com/julianhille/MuhammaraJS/releases/tag/wasm-v1.0.0-alpha.0
