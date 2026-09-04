# MuhammaraJS

`@muhammara/native-with-source` is a Node.js native addon for creating, reading,
and modifying PDF files and streams when a local source build or Electron rebuild
is required.

```sh
npm install @muhammara/native-with-source
```

The source-capable package downloads a
matching prebuilt binary when available and otherwise compiles its bundled
`src/` tree with the local Node.js build toolchain. It exposes the same API as
`@muhammara/native`, which is the smaller prebuilt-only package.

Source builds compile the bundled OpenSSL source through the addon build. They require the
platform C/C++ toolchain, Perl, and `make` on Unix-like systems or Perl, NMake,
and Visual Studio Build Tools on Windows; no separate OpenSSL installation is
required.

Windows builds use `OPENSSL_VS_INSTALL_PATH`, `GYP_MSVS_OVERRIDE_PATH`,
`VSINSTALLDIR`, or `npm_config_msbuild_path` when set, then fall back to
discovering Visual Studio with `vswhere`.

Source fallbacks use all available CPU cores. On Unix-like systems, `ccache` can
accelerate repeated rebuilds when configured through `CC` and `CXX`, but it is
not required.

To prepare a release prebuild locally, run:

```sh
npm run package --workspace=@muhammara/native-with-source
```

OpenSSL is statically linked into the prebuilt; no separate OpenSSL libraries are
needed at runtime.

For browsers, Web Workers, and byte-oriented PDF input/output, use
[`@muhammara/wasm`](https://muhammarajs-wasm.readthedocs.io/). It needs no native
Node.js addon and returns `Uint8Array` PDF data for browser APIs, uploads,
downloads, and storage.

After a successful source build, remove the source tree before packaging an
application with:

```sh
muhammara-clean-source
```

The compiled addon remains usable. Rebuilds, including `@electron/rebuild`,
require the source tree, so reinstall `@muhammara/native-with-source` before
rebuilding. `npm ci` restores it from npm's normal package cache.

To keep an existing `require("@muhammara/native")` import while selecting the
source-capable package, install it as an npm alias:

```sh
npm install @muhammara/native@npm:@muhammara/native-with-source@<version>
```
