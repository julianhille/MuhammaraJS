# Muhammara WebAssembly

`@muhammara/wasm` is the browser, Worker, and Node WebAssembly target for
MuhammaraJS. It exposes a browser-safe, byte-first API instead of the native
Node package's filesystem and stream API.

## Node.js Native Addon

For Node.js applications that need filesystem paths, Node streams, or the full
native PDF API, use [`@muhammara/native`](https://muhammarajs.readthedocs.io/).
Choose `@muhammara/native-with-source` when the addon must build locally or be
rebuilt for Electron.

Start with [Browser Setup](browser-setup.md). Use [Recipe](recipe.md) for
high-level document work, or the [low-level API](low-level.md) for PDF writers,
readers, and modifiers. The [How-To Guides](how-to/index.md) cover concrete
browser tasks such as annotations, links, tables, image transforms, page boxes,
preview, and download.

Every completed writer and Recipe operation returns an owned `Uint8Array`. Use
it directly with `Blob`, uploads, downloads, or browser storage.

```js
import { createMuhammaraWasm } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
var pdfBytes = muhammara.createBlankPdf(595, 842);
var pdf = new Blob([pdfBytes], { type: "application/pdf" });
```

The native `muhammara` and `@muhammara/wasm` APIs are intentionally separate.
Do not copy native examples that use paths, Node streams, callbacks, or
`require()` into browser code. Review [Differences and
Restrictions](differences.md) for unsupported encryption and persistence
features.
