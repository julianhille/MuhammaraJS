# Build And Test

Build the WebAssembly package from the repository root:

```sh
npm run wasm:build
```

The build requires Docker and pulls `emscripten/emsdk:3.1.74` on first use. It
writes `packages/wasm/dist/muhammara-wasm.js` and
`packages/wasm/dist/muhammara-wasm.wasm`.

Docker is the only supported build toolchain. Start its daemon before running
the command; the build intentionally has no local-Emscripten fallback so release
artifacts use the pinned image. Release CI builds `dist/` first and publishes the
validated result with npm lifecycle scripts disabled.

After a build, run the focused checks:

```sh
npm run wasm:verify
npm run wasm:test
npm run wasm:test:types
npm run wasm:test:paths
npm run wasm:test:exports
npm run wasm:test:browser
```

The browser test starts a local server and uses Chrome through `puppeteer-core`.
Set `CHROME_BIN` to the Chrome executable; CI provisions it with
`browser-actions/setup-chrome`. Wasm tests share native test fixtures under
`packages/native-with-source/tests/TestMaterials`.

Wasm documentation sources are package-local and are not published in the npm
package. The standalone WebAssembly documentation site is configured by
`packages/wasm/.readthedocs.yaml`; configure its Read the Docs project to use
that file. Native documentation is maintained separately in `packages/native/docs/`.
