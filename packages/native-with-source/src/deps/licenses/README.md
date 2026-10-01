# Third-party license texts

Verbatim license and copyright notices of the vendored libraries in `src/deps`
and of the JavaScript-shipped Adobe Glyph List, one file per text. Upstream
license files are copied unchanged from the release that is vendored; notices
that upstream keeps in a source header are copied from that header without
the comment markers.

`packages/wasm/scripts/third-party-licenses.mjs` maps each component to its
files. The Wasm build combines them, together with the Emscripten texts from
the toolchain image, into `dist/THIRD_PARTY_LICENSES.md` and embeds that text
in `muhammara-wasm.wasm`. Update the matching file here whenever a vendored
library is updated.
