# License Notices When Bundling Or Self-Hosting The Wasm

`muhammara-wasm.wasm` contains third-party code (PDFWriter, FreeType, zlib,
libjpeg, libpng, libtiff, Brian Gladman's AES, and the Emscripten runtime with
musl, libc++, libc++abi, compiler-rt, and dlmalloc). Their licenses ask that
their copyright and license notices accompany the code wherever it goes.

Bundlers copy the `.wasm` file under a hashed name and leave the package's
other files behind, so an application that ships the binary could otherwise
ship no notices. To prevent that, the notices travel inside the binary itself.

## What The Package Ships

- **Inside the `.wasm`**: a custom section named `license`, the very first
  section of the module, directly after the 8-byte header. It holds the
  notices as plain, uncompressed UTF-8 Markdown. WebAssembly engines ignore
  custom sections, so it does not change how the module runs.
- **As a file**: `dist/THIRD_PARTY_LICENSES.md`, byte for byte the same text,
  importable as `@muhammara/wasm/THIRD_PARTY_LICENSES.md`.

The text starts with a table of every component (name, version, SPDX license
expression, upstream source, and the file that ships it), followed by each
component's license and copyright notice in full. A license used by several
components is repeated for each one. The table also covers the bundled Roboto
Regular font (`fonts/Roboto-Regular.js`) and the Adobe Glyph List table
(`lib/glyph-list.js`), which ship in JavaScript rather than in the `.wasm`, so
one text covers the whole package.

## Read The Notices In Code

`Recipe.thirdPartyLicenses()` returns the section's text from the module that
`createRecipe()` loaded. The module is already compiled, so nothing is fetched,
compiled, or instantiated again:

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var notices = Recipe.thirdPartyLicenses(); // Markdown string
```

Use it to fill an "Open source licenses" dialog or an about page. It throws
when the WebAssembly module is not loaded, and when the loaded binary has no
`license` section (see below). If you load the binary through your own
`instantiateWasm` hook, pass the compiled `WebAssembly.Module` as the second
argument of its callback, or the function cannot read the section.

Reading the section yourself works too, for example on a server that has the
bytes:

```javascript
var module = await WebAssembly.compile(wasmBytes);
var [section] = WebAssembly.Module.customSections(module, "license");
var notices = new TextDecoder().decode(section);
```

## Read The Notices From A Shell

The text is near the start of the file, so ordinary tools show it:

```sh
head -c 3000 node_modules/@muhammara/wasm/dist/muhammara-wasm.wasm
strings node_modules/@muhammara/wasm/dist/muhammara-wasm.wasm | less
```

## Keep The Section When Post-Processing The Binary

Tools that shrink WebAssembly binaries can drop custom sections; `wasm-strip`
removes all of them by default. Bundlers that only copy the file keep the
section intact.

If your pipeline post-processes the binary, either configure the tool to keep
the section named `license`, or ship `dist/THIRD_PARTY_LICENSES.md` alongside your
application yourself. `Recipe.thirdPartyLicenses()` throws with a message naming that
file when it finds no section, so a stripped build is noticed rather than
silently shipping without notices.

## For Package Maintainers

Nothing license-related is committed in `packages/wasm`. The build assembles
the notices from:

- the verbatim license files in each vendored library's `licenses/` folder,
  such as `packages/native-with-source/src/deps/LibPng/licenses/`, one file per
  text;
- the Emscripten installation in the pinned emsdk image that linked the binary
  (Emscripten, musl, libc++, libc++abi, compiler-rt, and dlmalloc), so those
  texts always match the toolchain;
- the Roboto font's name table and `fonts/LICENSE.txt`, and
  `packages/native-core/licenses/` for the Adobe Glyph List, next to the
  `lib/glyph-list.js` table it covers.

`scripts/third-party-licenses.mjs` lists each component, its version, SPDX
expression, upstream source, where it ships, and its license files. After
linking, `build.sh` generates `dist/THIRD_PARTY_LICENSES.md` from it and
inserts the text into `dist/muhammara-wasm.wasm`, because `emcc` runs
`wasm-opt`, which would otherwise move custom sections to the end of the
module.

When you update a vendored library, update the files in its `licenses/` folder and
its entry in `third-party-licenses.mjs`. The build fails when a license file is
missing or a component's version disagrees with the version its headers state,
and when the binary is not a version-1 module or already has a `license`
section. `npm run test:licenses --workspace=@muhammara/wasm` checks a built
package: the section is first and appears once, equals
`dist/THIRD_PARTY_LICENSES.md`, lists every component, still contains the
current license files, and every file in those `licenses/` folders is used.
