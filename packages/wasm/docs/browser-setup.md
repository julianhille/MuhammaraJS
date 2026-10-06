# Browser Setup

Install the ESM package in the browser application's dependency set:

```sh
npm install @muhammara/wasm
```

Load the module asynchronously before creating documents. This lets the package
load its WebAssembly binary in a page or module Worker.

```js
import { createMuhammaraWasm } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
var writer = muhammara.createWriter();
```

The package is ESM-only. Browser applications should serve the bundled module
and its `.wasm` asset over HTTP through their bundler or static server. Do not
use synchronous CommonJS loading.

## TypeScript

The package ships its own declarations and requires TypeScript 5.7 or later.
PDF bytes returned by the package, such as `endPDF()`, `end()`, and
`createBlankPdf()`, are typed as `Uint8Array<ArrayBuffer>`, so they can be passed
to `new Blob([bytes])` or `new Response(bytes)` without a cast.

## Load The WebAssembly Binary

By default the package loads `muhammara-wasm.wasm` from next to its own
module, and bundlers emit the file automatically. To serve it from a CDN or
supply bytes the application retrieved itself, use the `locateFile` or
`wasmBinary` options described in [Load the WebAssembly Binary From a CDN or
Your Own Bytes](how-to/load-the-wasm-binary.md).

## Load bidi-js Without a Bundler

Reordering right-to-left text, with the `direction` option, uses the
[bidi-js](https://github.com/lojjic/bidi-js) package, which installs with
`@muhammara/wasm`. The package loads it with `import("bidi-js")` when it
starts, so bundlers such as Vite and webpack keep it as a chunk. A page that
loads the package's modules without a bundler maps the bare specifier itself:

```html
<script type="importmap">
  {
    "imports": {
      "@muhammara/wasm": "/node_modules/@muhammara/wasm/index.js",
      "bidi-js": "/node_modules/bidi-js/dist/bidi.mjs"
    }
  }
</script>
```

Pass `bidi: false` to `createMuhammaraWasm()` or `createRecipe()` to skip
loading it when the page never sets `direction`. Without bidi-js, whether
skipped or unresolved, everything else works, and every call that has to order
text by direction throws an error that names bidi-js instead of drawing the
text in the wrong order: text with right-to-left characters and an `"auto"`,
`"ltr"` or `"rtl"` direction, `"rtl"` text, and a line whose flowed runs ask
for different directions. Text drawn as given, with the default `"none"`,
needs no bidi-js, right-to-left characters included.

Module Workers do not read the page's import map in every browser; bundle
the Worker, or load bidi-js there yourself.

Call `loadBidi()` to load bidi-js later, for example once a document first
needs right-to-left text after a factory ran with `bidi: false`. Instances
already created reorder text as soon as it resolves. Without an argument it
imports `"bidi-js"`; where that specifier does not resolve, pass the module
you imported yourself:

```js
import { createRecipe, loadBidi } from "@muhammara/wasm";

var Recipe = await createRecipe({ bidi: false });
// Later, when right-to-left text is needed:
await loadBidi(await import("/node_modules/bidi-js/dist/bidi.mjs"));
```

## Work With Bytes

Keep source PDFs, fonts, and images as bytes in application code. Inputs are
`Uint8Array` or `ArrayBuffer`; output remains owned JavaScript bytes after an
operation completes.

Continue with [Byte Assets and Blob Input](byte-assets.md), then run the
[interactive browser examples](browser-examples.md).
To display or transfer generated output, see [Preview, Download, or Upload a
PDF](how-to/serve-a-pdf-response.md).
