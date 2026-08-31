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
npm run wasm:test:exports
npm run wasm:test:browser
```

The browser test starts a local server and uses Firefox. It expects
`/usr/bin/firefox` by default; set `FIREFOX_BIN` for another executable. Wasm
tests share native test fixtures under `packages/native-with-source/tests/TestMaterials`.

Wasm documentation sources are package-local and are not published in the npm
package. Stage them for MkDocs with `npm run docs:stage`; that generated
directory must not be edited or committed.
