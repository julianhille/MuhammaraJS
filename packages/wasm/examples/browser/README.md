# Browser Example

## Run Locally

This dependency-free application exercises the public byte-first package from a
browser page or module Worker. It creates a low-level PDF, parses it, modifies
it, copies/appends/merges/embeds pages, builds and edits a Recipe composition,
parses both final outputs, and exposes preview and download controls.

The tabs keep that complete laboratory intact and add focused, runnable how-to
examples for annotations, URL links, HTML lists, page boxes, rotated-page
coordinates, grayscale form XObjects, image transformations, and tables. Each
focused example generates and parses its own previewable PDF; only image
transformations require an upload. The
Tables tab and complete Recipe workflow use bundled Roboto Regular when no
custom font is uploaded. With an upload, they skip importing Roboto: Tables passes
the uploaded bytes as `createRecipe({ defaultFont: assets.font })`, while the
complete workflow uses `defaultFont: false` and demonstrates named registration.

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

The workflow renders Recipe text and tables without uploads. Supplying a custom font
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

- [annotations](https://muhammarajs-wasm.readthedocs.io/how-to/add-review-annotations/)
- [links](https://muhammarajs-wasm.readthedocs.io/how-to/add-url-links/)
- [HTML lists](https://muhammarajs-wasm.readthedocs.io/how-to/render-html-lists/)
- [page boxes](https://muhammarajs-wasm.readthedocs.io/how-to/set-page-boxes/)
- [rotated pages](https://muhammarajs-wasm.readthedocs.io/how-to/add-content-to-rotated-pages/)
- [image transformations](https://muhammarajs-wasm.readthedocs.io/how-to/place-and-transform-images/)
- [tables](https://muhammarajs-wasm.readthedocs.io/how-to/create-tables/)

Focused documentation: [browser setup](https://muhammarajs-wasm.readthedocs.io/browser-setup/),
[byte and Blob/File assets](https://muhammarajs-wasm.readthedocs.io/byte-assets/),
[low-level API](https://muhammarajs-wasm.readthedocs.io/low-level/),
[Recipe](https://muhammarajs-wasm.readthedocs.io/recipe/),
[restrictions](https://muhammarajs-wasm.readthedocs.io/differences/), and the
[TypeScript reference](https://muhammarajs-wasm.readthedocs.io/reference/).

## Resource And Trust Boundaries

Keep input and output size limits appropriate to the application. PDF parsing,
font loading, and image decoding can perform synchronous CPU and memory work;
run untrusted documents in a terminable Worker rather than the main thread.
This sample suggests 25 MB input and 50 MB output as illustrative UI guidance,
not library-enforced limits.

PDF 2.0/AES-256 encryption, continuation state files, filesystem paths, Node
streams, plugins, and Node EventEmitter hooks are unsupported. The example uses
`Uint8Array`, exact `ArrayBuffer` slices, `Blob`, and `File` inputs. It calls
`end()` or `dispose()` for owners, unregisters assets, calls `disposeAssets()`,
terminates Workers, and revokes replaced/final object URLs.

## Automated Browser Validation

```sh
npm run wasm:test:browser
```

The browser runner uses `puppeteer-core`, imports `workflow.mjs`, injects
JPEG/PNG/TIFF fixtures as bytes, executes the complete workflow with the bundled
Recipe font in both the
page and module Worker validation contexts, asserts parse-back summaries, and
checks zero-setup table previews and object-URL replacement/disposal behavior.
Set `CHROME_BIN` to test Chrome or `FIREFOX_BIN` to test Firefox. Chrome remains
the CI default.
