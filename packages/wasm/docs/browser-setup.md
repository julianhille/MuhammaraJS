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

Keep source PDFs, fonts, and images as bytes in application code. Inputs are
`Uint8Array` or `ArrayBuffer`; output remains owned JavaScript bytes after an
operation completes.

Continue with [Byte Assets and Blob Input](byte-assets.md), then run the
[interactive browser examples](https://github.com/julianhille/MuhammaraJS/tree/develop/packages/wasm/examples/browser).
To display or transfer generated output, see [Preview, Download, or Upload a
PDF](how-to/serve-a-pdf-response.md).
