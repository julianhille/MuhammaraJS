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

Read the [Wasm documentation](https://muhammarajs-wasm.readthedocs.io/) for
installation, API, Recipe, browser example, and how-to guidance.
