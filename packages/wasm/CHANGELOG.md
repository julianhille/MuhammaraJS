# Changelog

All notable changes to `@muhammara/wasm` are documented in this file.

## [Unreleased]

### Added

- Add browser-safe, byte-first PDF creation, reading, modification, and Recipe
  APIs for browser pages and Workers.
- Add Chrome page and Worker validation, TypeScript declarations, ABI export
  checks, and lifecycle regression coverage.

### Fixed

- Validate Wasm ABI exports, resource ownership, temporary-file cleanup, and
  bounded byte input/output handling.

## [1.0.0-alpha.0]

Initial alpha release of `@muhammara/wasm`.

### Breaking Changes

- This is a separate browser-first package, not a drop-in replacement for the
  unscoped `muhammara` or `@muhammara/native` Node.js packages. It accepts byte
  assets rather than filesystem paths and returns `Uint8Array` PDF data.
- Node.js streams, filesystem APIs, Electron rebuilds, and OpenSSL-backed PDF
  encryption are unavailable in the Wasm runtime.
