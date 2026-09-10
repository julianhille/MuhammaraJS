# Recipe default font

`Roboto-Regular.js` contains a base64 encoding of the complete, unmodified
`packages/native-core/fonts/Roboto.ttf` face (Copyright 2012 Google Inc.,
Apache-2.0). See `LICENSE.txt` and `../THIRD_PARTY_NOTICES.md`.

Regenerate from the repository root with:

```sh
node packages/wasm/scripts/generate-default-font.mjs
```

The ESM representation works in browsers, module Workers, and Node without a
font URL, filesystem access, or bundler-specific binary imports. `createRecipe()`
dynamically imports this module only when no `defaultFont` option is supplied;
custom default bytes and `defaultFont: false` skip it. The low-level API never
imports it. Recipe decodes and registers the face lazily per runtime. The
original font is not subsetted or otherwise modified.
