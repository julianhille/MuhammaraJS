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
module, and bundlers emit the file automatically. To serve it from a CDN or
supply bytes the application retrieved itself, use the `locateFile` or
`wasmBinary` options described in [Load the WebAssembly Binary From a CDN or
Your Own Bytes](how-to/load-the-wasm-binary.md).

## Work With Bytes

Keep source PDFs, fonts, and images as bytes in application code. Inputs are
`Uint8Array` or `ArrayBuffer`; output remains owned JavaScript bytes after an
operation completes.

Continue with [Byte Assets and Blob Input](byte-assets.md), then run the
[interactive browser examples](browser-examples.md).
To display or transfer generated output, see [Preview, Download, or Upload a
PDF](how-to/serve-a-pdf-response.md).
