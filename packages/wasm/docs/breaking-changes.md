# Breaking Changes

## Version 1.x

- `recrypt()` no longer accepts `version: 20`. Existing TypeScript calls fail
  type checking and JavaScript calls throw because WebAssembly cannot provide
  PDF 2.0/AES-256 encryption. Use a PDF 1.0 through 1.7 version instead.

For the browser runtime's supported APIs and deliberate differences from the
native packages, see [Compatibility](differences.md).
