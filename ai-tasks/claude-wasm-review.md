# Claude Wasm Review

This file is Claude's own review record for `packages/wasm`, kept separate
from `ai-tasks/wasm.md` (the project's living task file, which already
contains the same findings folded into its `## Review Findings —
Build/Export Wiring And Native Pointer Ownership` section along with the
disposition and fixes applied there). This document is the standalone
write-up: the original findings, then the re-review pass that verified
which fixes actually landed in the code, plus one correction to Claude's
own original analysis.

## Scope

Reviewed on 2026-08-30, focused on the in-progress branch work around the
new `packages/native` / `packages/wasm` monorepo split: the Wasm build
structure (`packages/wasm/CMakeLists.txt`, `build.sh`), the six
`packages/wasm/src/*.cpp` files against the actual Emscripten export list
and the vendored PDFWriter ownership contracts, the JS bindings in
`packages/wasm/lib/`, the docs build (`mkdocs build --strict`), and the
examples.

## Original Findings (first pass)

### Critical and high priority

1. **Twelve JS-called native functions were missing from
   `-sEXPORTED_FUNCTIONS`, breaking modifier form content entirely.**
   `packages/wasm/CMakeLists.txt:47-93` never listed
   `muhammara_wasm_modifier_form_operator` (`wasm_api_modifier.cpp:725`),
   `_form_set_font` (`:773`), `_form_set_font_name` (`:782`), `_form_show_text`
   (`:790`), `_form_write_free_code` (`:827`), `_form_write_stream` (`:836`),
   `_get_form_resources` (`:717`), `_font_text_dimensions` (`:470`),
   `_write_current_page_stream` (`:593`), `_create_tiff_form` (`:676`),
   `muhammara_wasm_object_indirect_reference` (`wasm_api_reader.cpp:494`), and
   `_object_stream_content_start` (`:488`). All twelve are called from
   `packages/wasm/lib/writer-to-modify.js`. Any build from the original
   `CMakeLists.txt` would throw `TypeError: ... is not a function` the moment
   user code drew into a modifier-created form, read an indirect-object
   reference, or read a stream's content-start offset.

2. **`muhammara_wasm_reader_get_parser_stream` appeared to delete a non-heap
   pointer on reader close.** `wasm_api_reader.cpp:277-283` wraps
   `reader->GetParser().GetParserStream()` in a `WasmByteReader`, and
   `PDFParser::GetParserStream()` returns `&mStream`, a pointer to a member
   field rather than a `new`-allocated object. `WasmReader::~WasmReader()`
   unconditionally does `if (byteReader->ownsReader) delete byteReader->reader;`.
   Flagged as: closing any reader that ever called `getParserStream()` would
   call `delete` on a non-heap pointer. **See the correction below — this
   finding was wrong.**

3. **`WasmObjectsContext`'s destructor could write a duplicate `endobj` and
   corrupt output.** `wasm_api_internal.h:125-141`, when a PDF stream was
   still active at destruction, called `context->EndPDFStream(stream->stream)`
   — which already calls the native `ObjectsContext::EndIndirectObject()`
   internally — and then fell through to
   `if (indirectObject) context->EndIndirectObject();` because the wrapper's
   own `indirectObject` flag was never reset, emitting a stray `endobj`.

4. **Annotation writers left an indirect object open on the `EndDictionary`
   failure path.** The shared `writeAnnotation()` helper and the two
   hand-rolled duplicates `muhammara_wasm_recipe_annotation` and
   `muhammara_wasm_recipe_annotation_full` all did
   `if (objects.EndDictionary(dictionary) != PDFHummus::eSuccess) return 0;`
   with no matching `objects.EndIndirectObject()`, leaving the underlying
   `ObjectsContext` mid-indirect-object and corrupting every subsequent write
   on that recipe/modifier for the rest of its life.

5. **The two duplicated annotation functions had already drifted from the
   shared helper's validation.** They skipped the `dictionary == nullptr`
   check that `writeAnnotation()` has after `StartDictionary()`, and
   `_annotation_full` never validated that `color`/`borderDash`/`quadPoints`
   were non-null when their length arguments were positive — a caller
   passing `borderDashLength > 0` with a null `borderDash` pointer would
   null-deref at `borderDash[i]`.

### Medium priority

6. **The Wasm and native builds compiled the vendored PDFWriter core from two
   different physical locations.** `packages/wasm/CMakeLists.txt:19-25`
   builds from the pre-migration root `src/deps`, while
   `packages/native/binding.gyp` builds from `packages/native/src/deps`, a
   copy `packages/native/scripts/prepare-source.js` regenerates from root
   `src/` on every `npm install`. Not theoretical: this branch's own
   uncommitted changes fixed two real leaks directly in the root copy only
   (`PDFPageMergingHelper.cpp` and `PDFModifiedPage.cpp`), so until
   `npm install` regenerated `packages/native/src`, the native build was
   compiling the pre-fix, leaking version of both files.

7. **`packages/wasm/package.json`'s `prepack` hard-depends on Docker.**
   `"prepack": "npm run build"` runs `build.sh`, which shells out to Docker
   with a pinned `emscripten/emsdk:3.1.74` image. Works on CI (Docker
   preinstalled) but `npm pack`/`npm publish` would fail opaquely on any
   machine without Docker.

8. **Inconsistent null handling across the `*_write_free_code` family.**
   `muhammara_wasm_modifier_write_free_code`,
   `muhammara_wasm_modifier_form_write_free_code`, and
   `muhammara_wasm_writer_form_write_free_code` guarded only
   `(freeCode/code == nullptr && length != 0)` and then constructed
   `std::string(freeCode, length)` directly — a null pointer with
   `length == 0` constructs `std::string(nullptr, 0)`, UB per the standard
   (harmless in practice, worth closing).

9. **`showTJ`'s `glyphOffsets` sentinel-length contract was undocumented and
   unvalidated at the C ABI.** `showTJ()` reads `glyphOffsets[index + 1]` for
   glyph-type TJ entries, requiring the caller to allocate one more element
   than `count`. The JS binding honored this correctly, but the exported
   function took no length parameter to validate the contract, so any other
   caller of the raw Wasm export omitting the sentinel element would cause an
   out-of-bounds read.

10. **A handful of malloc-returning helpers treated `malloc(0)` as a hard
    failure.** `muhammara_wasm_recipe_end_pdf`, `muhammara_wasm_create_blank_pdf`,
    `muhammara_wasm_modifier_end_pdf`, `copyObjectString`, and
    `muhammara_wasm_pdf_text_string_from_utf8`/`_to_utf8`/`_pdf_date_normalize`
    all called `std::malloc(size)` and treated a `nullptr` result as failure
    even though `malloc(0)` may legitimately return `nullptr`. Low impact for
    the PDF-output functions (never legitimately zero bytes) but could turn a
    valid empty-string result from the text/date helpers into a spurious
    thrown error.

## Re-Review: What Actually Landed In The Code

Verified by diffing the current working tree against the pre-fix baseline
file-by-file (not by trusting commit messages or task-list checkmarks) and,
where a fix touched a public C signature, tracing the change through to the
JS call sites.

**Fixed and verified correct:**

- **#1 — exports.** All 12 previously-missing symbols are now in
  `CMakeLists.txt`'s `-sEXPORTED_FUNCTIONS`. A new
  `packages/wasm/scripts/check-exports.mjs` (wired up as `npm run
test:exports`) now scans every `WASM_EXPORT` C definition and every
  `_muhammara_wasm_*` call in `lib/*.js` and fails the build if either side
  has a symbol the other doesn't — a real regression gate, not a one-time
  patch.
- **#3 — destructor double-`EndIndirectObject`.** `WasmObjectsContext`'s
  destructor now resets `indirectObject = false` after ending an active
  stream, before the trailing `if (indirectObject) EndIndirectObject();`
  check — matching the pattern already used by the exported
  `end_pdf_stream` function.
- **#4 — annotation indirect-object leak on failure.** `writeAnnotation()`
  and both hand-rolled duplicates now call `EndIndirectObject()`
  unconditionally after `StartNewIndirectObject()` succeeds, with the
  dictionary status captured and checked afterward instead of gating the
  cleanup call.
- **#8 — `*_write_free_code` null handling.** All three flagged call sites
  now use `code ? code : ""` / `freeCode ? freeCode : ""` before constructing
  the `std::string`, matching the pattern `muhammara_wasm_writer_write_free_code`
  already used.
- **#9 — `showTJ` sentinel validation.** The C function gained a
  `glyphOffsetsLength` parameter and validates
  `glyphOffsetsLength >= static_cast<unsigned int>(count) + 1` in its initial
  guard clause, before any indexing. Confirmed the JS side was updated to
  match: `lib/helpers.js`'s `withTJItems()` now passes `glyphOffsets.length`
  as a new argument in the correct position, and both `lib/writer.js` and
  `lib/writer-to-modify.js`'s `show_tj`/`tj` call sites use rest-spread
  (`...pointers` / `...args`), so the new argument flows through
  automatically with no per-call-site edit needed.
- **#10 (partial, intentionally).** `copyObjectString`
  (`wasm_api_internal.h`) and the three string/date helpers in
  `wasm_api_recipe.cpp` now use a `size == 0 ? 1 : size` fast path before
  calling `std::malloc`. The PDF-output functions
  (`wasm_api.cpp`'s `muhammara_wasm_recipe_end_pdf` /
  `muhammara_wasm_create_blank_pdf`, and `wasm_api_modifier.cpp`'s
  `muhammara_wasm_modifier_end_pdf`) were deliberately left unchanged —
  confirmed via diff — since PDF output is never legitimately zero bytes.
  That's a reasonable place to stop.
- **#7 — Docker dependency.** `build.sh` now checks
  `command -v docker` and `docker info` up front and exits with a clear
  message pointing at `packages/wasm/docs/development.md` instead of an
  opaque Docker failure; that doc confirms Docker is the intentional, sole
  build toolchain (not a gap, just made explicit and fail-fast).

**Correction to the original review — #2 was a false positive.**

Re-checked `WasmByteReader`'s two constructor overloads against the actual
return types involved:

```cpp
class WasmByteReader {
  WasmByteReader(IByteReader* value, WasmReader* readerOwner, bool owns = true)
      : reader(value), owner(readerOwner), ownsReader(owns) {}

  WasmByteReader(IByteReaderWithPosition* value, WasmReader* readerOwner)
      : reader(value), positionedReader(value), owner(readerOwner),
        ownsReader(false) {}
};
```

Both `PDFParser::GetParserStream()` and
`PDFDocumentCopyingContext::GetSourceDocumentStream()` return
`IByteReaderWithPosition*` exactly (confirmed in `PDFParser.h`/`.cpp` and
`PDFDocumentCopyingContext.h`/`.cpp`), and `IByteReaderWithPosition` publicly
derives from `IByteReader`. C++ overload resolution prefers an exact-type
match over a derived-to-base implicit conversion, so
`new WasmByteReader(reader->GetParser().GetParserStream(), reader)` binds to
the _second_ constructor — the one that hard-codes `ownsReader = false` —
not the `bool owns = true` overload the original review assumed applied.
Both call sites (`wasm_api_reader.cpp` and `wasm_api_copying.cpp`) were
already correct and unchanged in the working tree. There was never a
double-free here. This was a genuine mistake in the first-pass analysis,
not a fix that landed — the code never needed to change.

**Judgment calls verified as reasonable, not defects:**

- **#5** — the two annotation duplicates were not consolidated onto the
  shared `writeAnnotation()` helper (that was a design suggestion, not a
  correctness bug), but the actual bugs were fixed directly in both copies:
  both now reject a null dictionary (closing the indirect object first) and
  both now reject a null array pointer paired with a positive length.
  Acceptable trade-off — the legacy compact bridge is a documented internal
  compatibility symbol and the full bridge carries extra Recipe-only fields,
  so forcing both through the smaller helper would have discarded behavior
  rather than improved safety.
- **#6** — `CMakeLists.txt` still builds from root `src/deps` rather than
  `packages/native/src/deps`. Confirmed `packages/native/src` is gitignored
  and regenerated by `prepare-source.js` on install/staging, and Wasm CI
  never reads from it, so root `src/` remains the single actual source of
  truth in practice; redirecting Wasm's CMake at the ignored, generated
  native copy would be the riskier change. The "two build paths" framing in
  the original finding was overstated once the generation step is accounted
  for.

## Bottom Line

Nothing in this pass looked incorrectly fixed or introduced a new
regression. Every fix that was supposed to land did, and landed correctly
(export list, destructor reset, annotation cleanup, free-code null safety,
`showTJ` validation plus its JS call sites, and the Docker preflight). The
one substantive outcome of the re-review is the retraction of finding #2 —
originally flagged as the most severe issue — which turned out to be a
misreading of C++ overload resolution rather than a real bug.

## OpenCode Response (2026-08-31)

I independently repeated the review rather than relying on this document's
conclusion. The current source and a fresh Emscripten build agree with the
re-review.

- The compiled `dist/muhammara-wasm.js` exposes all 280 direct
  `_muhammara_wasm_*` symbols called from `packages/wasm/lib/`.
- `npm run wasm:test:exports` now checks both directions: every direct JS ABI
  call must be in CMake's export list, and every `WASM_EXPORT` definition in
  `packages/wasm/src/` must be listed there. The check is part of Wasm CI.
- The active raw-stream owner-disposal regression is covered by
  `MemoryLifecycle.test.mjs`; it exercises the fixed destructor path.
- Fresh-build targeted tests for modifier forms, parser streams, annotations,
  text/TJ operators, and lifecycle cleanup passed. The full Wasm suite,
  TypeScript/path/export checks, and Firefox page/Worker/UI validation also
  passed.

The parser-stream ownership report remains a false positive because C++ selects
the more-specific `IByteReaderWithPosition*` constructor, which hard-codes
`ownsReader = false`. The proposed CMake source-path redirect remains rejected:
root `src/` is canonical, while `packages/native/src` is intentionally ignored
and materialized for native installation/staging. Redirecting Wasm to it would
make clean Wasm CI depend on generated state.
