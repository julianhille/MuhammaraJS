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

## Load the WebAssembly Binary

By default the package loads `muhammara-wasm.wasm` from next to its own
module through `import.meta.url`, which bundlers such as Vite and webpack
detect and emit. `createMuhammaraWasm()` and `createRecipe()` accept two
options to load it from somewhere else.

`locateFile` returns the location to load the binary from. In pages and
Workers the package fetches that URL and compiles it while it downloads:

```js
var muhammara = await createMuhammaraWasm({
  locateFile: (path) =>
    path.endsWith(".wasm")
      ? "https://cdn.example.com/muhammara-wasm.wasm"
      : path,
});
```

`wasmBinary` supplies the binary as a `Uint8Array` or `ArrayBuffer`, and
nothing is fetched or read. Use it when the application retrieves the binary
itself, for example with its own caching or headers, or from a `File`:

```js
var bytes = await (await fetch(wasmUrl)).arrayBuffer();
// or: var bytes = await file.arrayBuffer();
var Recipe = await createRecipe({ wasmBinary: bytes });
```

Other typed arrays, `DataView`, and `Blob` or `File` objects are rejected with a
`TypeError`; read a `Blob` with `arrayBuffer()` first. `limits.maxInputBytes`
does not apply to the binary. Under Node, `locateFile` resolves paths and
`file:` URLs only, so fetch a binary served over `https:` yourself and pass
`wasmBinary`.

When the binary comes from another origin, the server must send
`Access-Control-Allow-Origin`. Serve it as `application/wasm`; otherwise the
package downloads the whole file before compiling it. A Content Security
Policy must allow the host under `connect-src` and allow compilation with
`'wasm-unsafe-eval'`.

## Work With Bytes

Keep source PDFs, fonts, and images as bytes in application code. Inputs are
`Uint8Array` or `ArrayBuffer`; output remains owned JavaScript bytes after an
operation completes.

Continue with [Byte Assets and Blob Input](byte-assets.md), then run the
[interactive browser examples](browser-examples.md).
To display or transfer generated output, see [Preview, Download, or Upload a
PDF](how-to/serve-a-pdf-response.md).
