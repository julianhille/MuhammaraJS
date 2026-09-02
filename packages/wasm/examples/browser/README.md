# Executable Browser And Module Worker Example

This dependency-free application exercises the public byte-first package from a
browser page or module Worker. It creates a low-level PDF, parses it, modifies
it, copies/appends/merges/embeds pages, builds and edits a Recipe composition,
parses both final outputs, and exposes preview and download controls.

The tabs keep that complete laboratory intact and add focused, runnable how-to
examples for annotations, URL links, page boxes, rotated-page coordinates,
image transformations, and tables. Each focused example generates and parses
its own previewable PDF; only image transformations and tables require uploads.

## Run It

Build the package first, then serve the repository root. The existing static
server supplies the correct JavaScript and WebAssembly MIME types:

```sh
npm run wasm:build
npm run wasm:server:browser
```

Open <http://127.0.0.1:8080/>.
`module-options.mjs` deliberately supplies `locateFile`, resolving only the
package's public `index.js` and generated `dist/muhammara-wasm.wasm` files. The
workflow modules contain no repository fixture paths. When installed in another
application, preserve that relationship or replace the two relative package
URLs with your bundler's `@muhammara/wasm` import and emitted `.wasm` URL.

The workflow is useful without uploads. Supplying a permissively licensed font
and JPEG/PNG/TIFF files additionally exercises registered fonts, metrics,
asynchronous `Blob`/`File` registration, image inspection, TIFF directory
selection and TIFF color treatment. No example binaries are checked in; the
automated test injects existing repository fixtures into these byte parameters.

## Modules

- `module-options.mjs`: asynchronous ESM loading and explicit `.wasm` location.
- `low-level.mjs`: boxes, graphics/text state, paths, clipping, colors, forms,
  images, metadata, links, annotations, raw streams, readers, modification,
  copying contexts, append, merge, and PDF-page forms.
- `recipe.mjs`: creation/editing, flowed HTML text, tables, shapes, metadata,
  annotations, links, registered PDF composition, overlay, split, and inspection.
- `workflow.mjs`: staged orchestration and parse-back results.
- `example-worker.mjs`: structured progress/results/errors across a transferable
  module Worker boundary.
- `lifecycle.mjs`: cancellation checks, structured errors, and object-URL cleanup.
- `app.mjs`: responsive UI, preview/download selection, and Worker termination.

The matching guides explain the focused examples:

- [annotations](../../docs/how-to/add-review-annotations.md)
- [links](../../docs/how-to/add-url-links.md)
- [page boxes](../../docs/how-to/set-page-boxes.md)
- [rotated pages](../../docs/how-to/add-content-to-rotated-pages.md)
- [image transformations](../../docs/how-to/place-and-transform-images.md)
- [tables](../../docs/how-to/create-tables.md)

Focused documentation: [browser setup](../../docs/browser-setup.md), [byte and
Blob/File assets](../../docs/byte-assets.md), [low-level API](../../docs/low-level.md),
[Recipe](../../docs/recipe.md), [restrictions](../../docs/differences.md), and the
[TypeScript reference](../../docs/reference.md).

## Resource And Trust Boundaries

Keep input and output size limits appropriate to the application. PDF parsing,
font loading, and image decoding can perform synchronous CPU and memory work;
run untrusted documents in a terminable Worker rather than the main thread.
This sample suggests 25 MB input and 50 MB output as illustrative UI guidance,
not library-enforced limits.

OpenSSL encryption/decryption, continuation state files, filesystem paths, Node
streams, plugins, and Node EventEmitter hooks are unsupported. The example uses
`Uint8Array`, exact `ArrayBuffer` slices, `Blob`, and `File` inputs. It calls
`end()` or `dispose()` for owners, unregisters assets, calls `disposeAssets()`,
terminates Workers, and revokes replaced/final object URLs.

## Automated Chrome Validation

```sh
npm run wasm:test:browser
```

The Chrome runner uses `puppeteer-core`, imports `workflow.mjs`, injects
font/JPEG/PNG/TIFF fixtures as bytes, executes the complete workflow in both the
page and module Worker validation contexts, asserts parse-back summaries, and
checks object-URL replacement/disposal behavior. Set `CHROME_BIN` when Chrome is
not discoverable by the runner.
