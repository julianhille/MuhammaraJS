# @muhammara/wasm

[![npm version](https://img.shields.io/npm/v/%40muhammara%2Fwasm.svg)](https://www.npmjs.com/package/@muhammara/wasm)
[![License](https://img.shields.io/npm/l/%40muhammara%2Fwasm.svg)](https://github.com/julianhille/MuhammaraJS/blob/develop/LICENSE)
[![Documentation](https://img.shields.io/badge/docs-readthedocs-blue.svg)](https://muhammarajs-wasm.readthedocs.io/)

Create, read, and modify PDF files in browsers, Web Workers, and Node.js.
`@muhammara/wasm` is the WebAssembly build of MuhammaraJS: no native addon, no
install-time build, one package for every platform. PDFs go in and come out as
bytes (`Uint8Array`, `ArrayBuffer`, `Blob`, `File`).

```sh
npm install @muhammara/wasm
```

[Run the browser example for version 1.0.0-beta.3](https://julianhille.github.io/MuhammaraJS/wasm/browser-example/1.0.0-beta.3/index.html).

## How The Packages Fit Together

MuhammaraJS is one PDF engine shipped in two ways. The same C++ library,
[PDF-Writer](https://github.com/galkahana/PDF-Writer), sits at the bottom of
every package; what differs is how it reaches your JavaScript.

```text
                      PDF-Writer (C++)
                 ┌────────────┴────────────┐
      Node.js native addon         WebAssembly build
                 │                         │
     @muhammara/native-core         @muhammara/wasm
      (shared JS, internal)     (browsers, Workers, Node.js)
         ┌───────┴────────┐
@muhammara/native  @muhammara/native-with-source
  (prebuilt only)    (prebuilt or source build)
```

| Package                                                                                        | Install it when                                                                                           |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [`@muhammara/native`](https://www.npmjs.com/package/@muhammara/native)                         | You run Node.js on a platform with a prebuilt binary. This is the default choice.                         |
| [`@muhammara/native-with-source`](https://www.npmjs.com/package/@muhammara/native-with-source) | No prebuilt matches your platform, or Electron must rebuild the addon.                                    |
| [`@muhammara/wasm`](https://www.npmjs.com/package/@muhammara/wasm)                             | You work in a browser or Web Worker, or cannot load native addons (for example some serverless runtimes). |
| [`@muhammara/native-core`](https://www.npmjs.com/package/@muhammara/native-core)               | Never directly. Both native packages depend on it and install it for you.                                 |

Both native packages expose the identical API, so switching between them is a
dependency change, not a code change. The Wasm package produces the same PDFs,
but it is byte-first (`Uint8Array`, `ArrayBuffer`, `Blob`, `File`) instead of
path-, stream-, and `Buffer`-oriented, so its JavaScript API is separate.

### Why There Are Also Native Packages

The native packages load PDF-Writer as a compiled Node.js addon instead of
WebAssembly. In Node.js and Electron that brings direct file paths and
streams, `Buffer` input and output, and APIs the browser sandbox cannot offer,
such as OpenSSL-backed encryption. The trade-off is a platform-specific binary:
[`@muhammara/native`](https://www.npmjs.com/package/@muhammara/native) downloads
a prebuilt one, and
[`@muhammara/native-with-source`](https://www.npmjs.com/package/@muhammara/native-with-source)
can compile it locally. Pick this Wasm package when you run in a browser, a
Worker, or a runtime without native addons; pick a native package for
file-heavy Node.js work. The
[differences page](https://muhammarajs-wasm.readthedocs.io/latest/differences.html) lists every API that behaves
differently or exists on only one side.

## Quick Start

The package is ESM. Load it in Node.js or through a browser bundler; the
WebAssembly module loads asynchronously, so each entry point is `async`.

Create a PDF with the high-level Recipe API:

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var pdfBytes = new Recipe()
  .createPage("A4")
  .text("Hello, PDF", 72, 72, { size: 24 })
  .endPage()
  .endPDF();
```

Add text to the first page of existing PDF bytes:

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var output = new Recipe(inputBytes)
  .editPage(1)
  .text("Reviewed", 72, 72)
  .endPage()
  .endPDF();
```

`output` is a new `Uint8Array`; `inputBytes` is not changed. Recipe page
numbers are one-based and coordinates start at the top-left corner.

Drop down to the low-level API when you need exact control over the PDF
content stream. Its coordinates start at the bottom-left corner, as in the PDF
specification:

```js
import { createMuhammaraWasm } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
var writer = muhammara.createWriter();
var page = new muhammara.PDFPage(0, 0, 595, 842);

writer
  .startPageContentContext(page)
  .drawRectangle(72, 700, 200, 60, { type: "fill", color: 0x1777d1 });
writer.writePage(page);

var pdfBytes = writer.end();
```

Next steps:

- [Browser setup](https://muhammarajs-wasm.readthedocs.io/latest/browser-setup.html) — bundlers, Workers, and
  serving the `.wasm` file
- [Recipe guide](https://muhammarajs-wasm.readthedocs.io/latest/recipe/index.html) and
  [low-level API](https://muhammarajs-wasm.readthedocs.io/latest/low-level.html)
- [How-to guides](https://muhammarajs-wasm.readthedocs.io/latest/how-to/index.html)

## Links

- [Documentation](https://muhammarajs-wasm.readthedocs.io/)
- [Changelog](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/wasm/CHANGELOG.md)
- [Breaking changes](https://muhammarajs-wasm.readthedocs.io/latest/breaking-changes.html)
- [Differences from the native packages](https://muhammarajs-wasm.readthedocs.io/latest/differences.html)
- [Issues](https://github.com/julianhille/MuhammaraJS/issues)
