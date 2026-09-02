# Breaking Changes

## Version 1.x

- `@muhammara/wasm` is a browser-first, byte-oriented package. It is not a
  drop-in replacement for the unscoped `muhammara` package or either native
  scoped package.
- APIs accept `Uint8Array`, `ArrayBuffer`, and, where documented, `Blob` input
  instead of Node.js filesystem paths and streams. Generated PDFs are returned
  as `Uint8Array` values.
- Native addon workflows, including Electron rebuilds and native prebuilt
  selection, are unavailable. Use `@muhammara/native-with-source` when an
  application needs a Node.js addon or a local source build.
- OpenSSL is intentionally omitted from the Wasm build. Encrypted PDFs can be
  detected but cannot be decrypted, and encrypted writing and re-encryption are
  unavailable.
