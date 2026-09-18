# How-To Guides

These task-oriented guides use the browser-safe, byte-first WebAssembly API.
They mirror the native package's common workflows while replacing filesystem
paths, Node streams, and CommonJS with `Uint8Array`, `Blob`, `File`, and ESM.

The [interactive browser examples](../browser-examples.md)
run annotations, links, HTML lists, page boxes, rotated pages, page deletion,
image
transformations, tables, and password changes on the page or in a module Worker.

To serve the WebAssembly binary from a CDN or load it from bytes you retrieved
yourself, see [Load the WebAssembly Binary](load-the-wasm-binary.md).

Review [Differences and Restrictions](../differences.md) before adapting native
examples, particularly for password-protected Recipe source editing.
