# How-To Guides

These task-oriented guides use the browser-safe, byte-first WebAssembly API.
They mirror the native package's common workflows while replacing filesystem
paths, Node streams, and CommonJS with `Uint8Array`, `Blob`, `File`, and ESM.

The [interactive browser examples](https://github.com/julianhille/MuhammaraJS/tree/develop/packages/wasm/examples/browser)
run annotations, links, page boxes, rotated pages, image transformations, and
tables on the page or in a module Worker.

Review [Differences and Restrictions](../differences.md) before adapting native
examples. In particular, encryption and password changes are unavailable in the
WebAssembly package.
