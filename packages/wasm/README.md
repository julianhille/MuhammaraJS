# Muhammara WebAssembly

`@muhammara/wasm` compiles the reusable C++ `PDFWriter` core for browser,
Worker, and Node.js WebAssembly runtimes. Use it for byte-first PDF work in
those environments. It does not compile the Node/V8 binding, so its API is
intentionally separate from `require("@muhammara/native")`.

For Node.js filesystem paths, streams, and the full native PDF API, use
`@muhammara/native`. Use `@muhammara/native-with-source` when the native addon
needs a local or Electron build.

```sh
npm install @muhammara/wasm
```

Load the ESM package in Node.js or a browser bundler, then add text to the first
page of existing PDF bytes:

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var output = new Recipe(inputBytes)
  .editPage(1)
  .text("Hello", 72, 72)
  .endPage()
  .endPDF();
```

`output` is a new `Uint8Array`; `inputBytes` is not overwritten. Recipe page
numbers are one-based.

[Run the browser example for version 1.0.0-beta.2](https://julianhille.github.io/MuhammaraJS/wasm/browser-example/1.0.0-beta.2/index.html).

Read the [Wasm documentation](https://muhammarajs-wasm.readthedocs.io/) for
installation and API guidance. The focused [Recipe topic
guides](https://muhammarajs-wasm.readthedocs.io/latest/recipe/index.html)
cover byte-first PDF creation, drawing, composition, modification, metadata,
and encryption. Browser examples and task-oriented how-to guides are available
on the documentation site.
