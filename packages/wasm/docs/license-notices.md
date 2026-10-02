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
Regular font (`fonts/Roboto-Regular.js`), the Adobe Glyph List table
(`lib/glyph-list.js`), and bidi-js (`lib/vendor/bidi-js.js`), which ship in JavaScript rather than in the `.wasm`, so
one text covers the whole package.

## Read The Notices In Code

`Recipe.thirdPartyLicenses(source)` resolves to the section's text. The
runtime lets Emscripten load the binary and does not keep it, so pass the
binary you want the notices of. It accepts:

- a URL, as a string or `URL`, which is fetched with
  `credentials: "same-origin"`, the same way the package loads the binary;
- the binary's bytes (`Uint8Array` or `ArrayBuffer`), or a `Blob` or `File`.

Bytes are not compiled: the section is read straight from them. The function
does not need the Recipe runtime that it hangs off; call it only where you
show the notices, such as an "Open source licenses" dialog or an about page.

In a page, pass the URL you serve the binary from, the same one you return
from `locateFile`:

```javascript
import { createRecipe } from "@muhammara/wasm";

var wasmUrl = "/assets/muhammara-wasm.wasm";
var Recipe = await createRecipe({
  locateFile: (path) => (path.endsWith(".wasm") ? wasmUrl : path),
});
var notices = await Recipe.thirdPartyLicenses(wasmUrl); // Markdown string
```

Under Node, `fetch()` cannot load `file:` URLs, so read the installed binary
and pass its bytes:

```javascript
import { readFile } from "node:fs/promises";
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var wasmBytes = await readFile(
  new URL("dist/muhammara-wasm.wasm", import.meta.resolve("@muhammara/wasm")),
);
var notices = await Recipe.thirdPartyLicenses(wasmBytes);
```

It rejects when the URL cannot be loaded, when the source is not a
WebAssembly binary, and when the binary has no `license` section (see below).

For a module you already compiled, read the section with the WebAssembly API:

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
application yourself. `Recipe.thirdPartyLicenses()` rejects with a message naming that
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
  `lib/glyph-list.js` table it covers, and for bidi-js, which native-core
  installs from npm and `lib/vendor/bidi-js.js` vendors unmodified.

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
