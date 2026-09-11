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
installation and API guidance. The focused [Recipe topic
guides](https://muhammarajs-wasm.readthedocs.io/latest/recipe/index.html)
cover byte-first PDF creation, drawing, composition, modification, metadata,
and encryption; browser examples and task-oriented how-to guides are included.
