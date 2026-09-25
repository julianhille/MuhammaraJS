# @muhammara/native

[![npm version](https://img.shields.io/npm/v/%40muhammara%2Fnative.svg)](https://www.npmjs.com/package/@muhammara/native)
[![License](https://img.shields.io/npm/l/%40muhammara%2Fnative.svg)](https://github.com/julianhille/MuhammaraJS/blob/develop/LICENSE)
[![Documentation](https://img.shields.io/badge/docs-readthedocs-blue.svg)](https://muhammarajs.readthedocs.io/)

Create, read, and modify PDF files from Node.js. `@muhammara/native` is the
small, prebuilt-only package of MuhammaraJS: it downloads a ready-made native
binary for your platform at install time and never compiles anything.

```sh
npm install @muhammara/native
```

If no prebuilt matches your platform, the install fails with an explicit
error. Install
[`@muhammara/native-with-source`](https://www.npmjs.com/package/@muhammara/native-with-source)
instead; it has the same API and can build from source.

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

### Why There Is Also A Wasm Package

Native addons need a compiled binary for the exact platform and a Node.js (or
Electron) runtime to load it. Browsers, Web Workers, and some edge or
serverless runtimes offer neither. For those, `@muhammara/wasm` compiles the
same PDF-Writer engine to WebAssembly: nothing to build at install time, one
package for every platform, and PDFs in and out as bytes. Stay on the native
package when you work in Node.js with files, streams, or `Buffer`s, or need an
API the Wasm build does not have; the
[Wasm differences](https://muhammarajs-wasm.readthedocs.io/latest/differences.html)
list what is native-only.

## Supported Platforms

- **Node.js** 20, 22, 24, and 25 or later.
- **Electron** 36 or later, tested up to 44.
- **Prebuilt binaries** for Linux x64 and arm64 (glibc and musl), macOS x64
  and arm64, and Windows x64. One Node-API 8 binary per platform serves every
  supported Node.js and Electron version.

Installation problems, pnpm 10 build approval, and source-build requirements
are covered in [Installation](https://muhammarajs.readthedocs.io/en/latest/getting-started/installation.html).

## Quick Start

Create a PDF with the high-level Recipe API:

```js
var { Recipe } = require("@muhammara/native");

new Recipe("new", "hello.pdf")
  .createPage("A4")
  .text("Hello, PDF", 72, 72, { size: 24 })
  .endPage()
  .endPDF();
```

Add text to the first page of an existing PDF held in a `Buffer`:

```js
var { Recipe } = require("@muhammara/native");

var output = new Recipe(inputBuffer)
  .editPage(1)
  .text("Reviewed", 72, 72)
  .endPage()
  .endPDF((bytes) => bytes);
```

`output` is a new `Buffer`; `inputBuffer` is not changed. Recipe page
numbers are one-based and coordinates start at the top-left corner.

Drop down to the low-level API when you need exact control over the PDF
content stream. Its coordinates start at the bottom-left corner, as in the PDF
specification:

```js
var muhammara = require("@muhammara/native");

var stream = new muhammara.PDFWStreamForBuffer();
var writer = muhammara.createWriter(stream);
var page = writer.createPage(0, 0, 595, 842);

writer
  .startPageContentContext(page)
  .drawRectangle(72, 700, 200, 60, { type: "fill", color: 0x1777d1 });
writer.writePage(page);
writer.end();

var pdfBuffer = stream.buffer;
```

Next steps:

- [Recipe guide](https://muhammarajs.readthedocs.io/en/latest/recipe/index.html) and
  [low-level API](https://muhammarajs.readthedocs.io/en/latest/low-level/index.html)
- [How-to guides](https://muhammarajs.readthedocs.io/en/latest/how-to/index.html) — watermarks, tables, annotations,
  passwords, deleting pages, serving a PDF response, and more

## Links

- [Documentation](https://muhammarajs.readthedocs.io/)
- [Changelog](https://github.com/julianhille/MuhammaraJS/blob/develop/CHANGELOG.md)
- [Breaking changes](https://muhammarajs.readthedocs.io/en/latest/breaking-changes.html)
- [Migrate from v6 (`muhammara`)](https://muhammarajs.readthedocs.io/en/latest/getting-started/migrate-from-v6.html)
- [Issues](https://github.com/julianhille/MuhammaraJS/issues)
