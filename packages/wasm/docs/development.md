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

## Compiler Cache

The pinned Emscripten image ships no `ccache`, so the build adds it in a thin
layer on top of that image and tags the result with the pinned digest. The
layer is built once per digest and reused afterwards; when it cannot be built,
for example without network access, the build falls back to the pinned image
and compiles without a cache.

Compiled objects are kept in `packages/wasm/.ccache/<configuration>` and the
CMake tree in `packages/wasm/build/<configuration>`, where the configuration
is derived from the build type and the sanitizer setting
(`release-sanitize-off`, `release-sanitize-on`). Sanitizer and normal builds
therefore never share objects. Wasm CI restores the cache per configuration
through `.github/actions/setup-wasm-build-cache`, keyed on the Emscripten image
digest, the build script, `CMakeLists.txt`, and the Wasm and shared C++
sources. Cached and uncached builds produce identical `dist/` bytes.

These environment variables adjust the build:

| Variable                        | Default                 | Effect                                                |
| ------------------------------- | ----------------------- | ----------------------------------------------------- |
| `MUHAMMARA_WASM_SANITIZE`       | `OFF`                   | Build with Emscripten LeakSanitizer.                  |
| `MUHAMMARA_WASM_BUILD_TYPE`     | `Release`               | `CMAKE_BUILD_TYPE` for the build.                     |
| `MUHAMMARA_WASM_CCACHE`         | `ON`                    | Set to `OFF` to build straight from the pinned image. |
| `MUHAMMARA_WASM_CCACHE_DIR`     | `packages/wasm/.ccache` | Root directory holding the per-configuration caches.  |
| `MUHAMMARA_WASM_CCACHE_MAXSIZE` | `1G`                    | Upper bound for one configuration's cache.            |

`./packages/wasm/build.sh --print-cache-directory` and
`--print-build-directory` report the directories for the current settings
without touching Docker; CI uses the first one so the workflow never repeats
the layout the script owns.

After a build, run the focused checks:

```sh
npm run wasm:verify
npm run wasm:test
npm run wasm:test:types
npm run wasm:test:paths
npm run wasm:test:exports
npm run wasm:test:browser
```

The browser test starts a local server and uses `puppeteer-core`. Set
`CHROME_BIN` to a Chrome executable or `FIREFOX_BIN` to a Firefox executable;
CI provisions Chrome with `browser-actions/setup-chrome`. Wasm tests share
native test fixtures under `packages/native-with-source/tests/TestMaterials`.

Wasm documentation sources are package-local and are not published in the npm
package. The standalone WebAssembly documentation site is configured by
`packages/wasm/.readthedocs.yaml`; configure its Read the Docs project to use
that file. Native documentation is maintained separately in `packages/native/docs/`.

## Documentation

Create a Python virtual environment and install the WebAssembly site's pinned
documentation dependencies:

```sh
python -m venv .docs-venv
source .docs-venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r packages/wasm/docs/requirements.txt
```

Build the site strictly before opening a pull request:

```sh
npm run docs:check --workspace=@muhammara/wasm
```

Serve a local preview with:

```sh
mkdocs serve --config-file packages/wasm/mkdocs.yml
```

Never commit generated `packages/wasm/docs/reference.md` or `packages/wasm/site/`
output.

## Release Tags

WebAssembly package tags trigger validation and publication. The package version
must match the version in the tag. Wasm releases use npm trusted publishing
through GitHub Actions OIDC and do not require an npm token.

Before the first Wasm release, configure an npm trusted publisher for
`@muhammara/wasm` that trusts this repository's Wasm release workflow and
release environment.

```sh
# WebAssembly release example.
git tag wasm-v1.0.0
git push origin wasm-v1.0.0
```

After successful publication, the workflow automatically creates a matching
`wasm-doc-v<version>` documentation tag. A later documentation-only correction
can be tagged without rebuilding or publishing the package:

```sh
git tag wasm-doc-v1.0.0.1
git push origin wasm-doc-v1.0.0.1
```

Documentation tags trigger only the documentation workflow.
