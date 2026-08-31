# MuhammaraJS Documentation

MuhammaraJS Native provides the Node/V8 binding for creating, reading, and
modifying PDF files and streams. Install the small prebuilt
`@muhammara/native` package, or `@muhammara/native-with-source` when a local
build or Electron rebuild is required.

For browsers and Web Workers, use
[`@muhammara/wasm`](https://muhammarajs-wasm.readthedocs.io/). It is a separate,
browser-safe WebAssembly API that reads and writes in-memory `Uint8Array` PDF
data for browser storage, uploads, downloads, and `Blob` APIs. Its API does not
use native filesystem paths or Node streams, so follow its dedicated
documentation rather than native examples.

## Documentation Versions

`latest` tracks the `develop` branch and can include unreleased behavior. Each
normal release tag has its own documentation version. After a release, its tag
is made the default Read the Docs version while `latest` continues to track
development.

For current release history, read the
[Changelog on GitHub](https://github.com/julianhille/MuhammaraJS/blob/develop/CHANGELOG.md).

## Documentation Sources

Native documentation is maintained in `packages/native/docs/` and built
independently from the Wasm site in `packages/wasm/docs/`.
