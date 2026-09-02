# WebAssembly Compatibility Work

## Scope

The Wasm target is a browser-safe, byte-first ESM API under `packages/wasm/`.
It builds the reusable C++ PDFWriter core from root `src/` with Emscripten and
does not build or alter the Node/V8 addon.
`createMuhammaraWasm()` and `createRecipe()` initialize asynchronously;
completed documents are `Uint8Array` values.

Node tests remain Node regressions. Wasm tests are ports that replace paths,
Buffers, and Node streams with bytes and assert observable PDF behavior. In a
Node-hosted Wasm test, `Buffer` is incidentally accepted because it subclasses
`Uint8Array`; it is not a browser API or a separate Wasm input contract. The
current Wasm Mocha suite runs in Node's Emscripten runtime. A dependency-free
real-browser runner uses Firefox's built-in WebDriver BiDi Remote Agent to run
the shared byte-first validation in both a page and module Worker.

## Current Baseline

- `packages/wasm/CMakeLists.txt` builds PDFWriter with pinned
  `emscripten/emsdk:3.1.74`; OpenSSL is disabled and JPEG, PNG, and TIFF are
  enabled.
- `packages/wasm/index.js` and `packages/wasm/index.d.ts` expose the byte-first low-level API and
  the separate async Recipe facade.
- `npm run wasm:test` runs the Node/Emscripten ports and
  `npm run wasm:test:types` type-checks `packages/wasm/tests/types.test.ts` with the
  repository TypeScript dependency.
- `npm run wasm:test:browser` serves `packages/wasm/tests/browser/`, starts headless
  Firefox, waits for structured page/Worker results, and exits nonzero on any
  failed assertion or timeout. It uses `/usr/bin/firefox` by default or
  `FIREFOX_BIN`; no automation package is required. The GitHub Actions Wasm
  job does not execute this browser command.

## Node And Wasm API Differences

Node behavior is the compatibility target where browser constraints permit it.
The following are deliberate, current differences; implementation details are
not listed as gaps.

| Area              | Node                                                   | Wasm                                                                                                     | Constraint / status                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading           | synchronous CommonJS addon                             | async ESM factory                                                                                        | Wasm instantiation is async.                                                                                                                                                                                                                             |
| Files and streams | paths, `Buffer`, Node/file/response streams            | `Uint8Array`/`ArrayBuffer`; `Blob`/`File` through explicit async methods; in-memory byte readers/writers | Browser APIs do not expose paths or Node streams. `PDFRStreamForBuffer` and `PDFWStreamForBuffer` are byte adapters, not Web/Node streams.                                                                                                               |
| Fonts and images  | filesystem sources                                     | registered or direct bytes                                                                               | Type 1 PFM, TTC indexes, and complete DFont bytes work. Installed macOS fonts and separately supplied resource forks do not.                                                                                                                             |
| PDF input/output  | path or stream input; path/stream output               | byte input and `Uint8Array` output                                                                       | Browser callers own persistence and downloads.                                                                                                                                                                                                           |
| Encryption        | OpenSSL-backed create, read, and recrypt               | unavailable                                                                                              | OpenSSL is omitted. Encrypted input can be detected but not decrypted; password options and encrypted writing/recrypt are excluded.                                                                                                                      |
| Continuation      | `shutdown(stateFilePath)` and `createWriterToContinue` | unavailable                                                                                              | The protocol requires persistent output/state storage; no browser storage adapter exists.                                                                                                                                                                |
| Events            | writer EventEmitter hooks                              | unavailable                                                                                              | Node EventEmitter behavior has no browser equivalent.                                                                                                                                                                                                    |
| Merge callback    | invoked between Node merge steps                       | invoked once after synchronous native merge                                                              | The byte merge is synchronous; page callbacks are not reproduced.                                                                                                                                                                                        |
| Recipe            | Node constructor and full path-oriented/layout API     | separate byte-first facade                                                                               | Byte-safe colors, vectors, shapes, TIFF-directory image placement, annotations, composition, and registered synchronous/async assets are covered; paths/plugin loading, `chroma("!load")`, Separation resource creation, and encryption remain excluded. |

## Implemented Low-Level Surface

- Creation, pages, page boxes, content operators, text/font metrics, metadata,
  links, annotations, resource dictionaries, raw object/dictionary/stream
  contexts, and lifecycle guards.
- JPEG image XObjects; JPEG, PNG, and TIFF form XObjects; TIFF directory
  selection and black-and-white/grayscale treatments; image type, dimensions,
  page count, and JPEG metadata.
- Byte-backed readers, parsed objects/pages/streams, positioned byte readers,
  writer modification including page-scoped direct-reference replacement,
  copying contexts, direct append/merge, PDF-page forms, PDF embed forms, deep
  object copying, and source-object replacement.
- Modifiers create open generic Form XObjects with the writer content-context
  surface, resources, byte content streams, optional object IDs, `form.end()`/
  `modifier.endFormXObject(form)` lifecycle guards, and font metrics. Writer
  forms must instead be closed with `writer.endFormXObject(form)`. They also
  create TIFF forms from registered/direct bytes with writer-equivalent page and
  black-and-white/grayscale treatment options; modifier-created pages expose
  their associated page and active content stream.
- Type declarations distinguish writer and modifier form end contracts and
  cover sync modifier options, merge callbacks, font metrics, and
  `createRecipe()` loading; the executable fixture is checked by
  `wasm:test:types`.

Remaining low-level work is limited to browser-incompatible APIs above and
unbound Node-specific behavior, not prior claims that TIFF treatments, deep
copying, modified dictionary replacement, or TypeScript verification are
missing.

## Recipe Difference Ledger

| Recipe family                 | Status  | Wasm behavior / evidence                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colors                        | partial | `chroma` and hex, percent, array, named gray/RGB/CMYK colors are byte-safe. `chroma("!load", path)` and explicit Separation registration throw: the first is a Node-path loader and the bridge cannot create a Separation color-space dictionary.                                                                                                                                                                    |
| Vectors and shapes            | covered | Lines, polygons, circle, rectangle, ellipse, arc/pie, n-gon, star, every arrow type (`triangle`, `dart`, `kite`, numeric `1`/`2` aliases, including double), and every triangle trait (`sss`, `sas`, `asa`, `vtx`) share color, opacity, dash, line, rotation, and skew handling.                                                                                                                                    |
| Images                        | partial | Registered JPEG/PNG/TIFF bytes support fitting, alignment, opacity, transforms, zero-based TIFF `index`, repeat core-cache placement, and explicit async byte registration. Node paths, streams, and the Node `xObjectForm` loader remain excluded.                                                                                                                                                                  |
| Browser and Worker            | browser | The shared Firefox validation creates text/table, annotations, composition, color/vector/shape, registered-image, async-asset, edit, and byte-reader/writer Recipe output in both a page and module Worker.                                                                                                                                                                                                          |
| Annotation, info, composition | partial | Queued annotations support comments, markup/non-markup fields, replies, rich text, flags, coordinates, and rotation. Registered PDF bytes support append, page-selected overlay with scale/fit options, deferred insert/rebuild, static/instance split, metadata, and structural summaries. The core byte append path does not deep-copy source `/Annots`; encryption remains an explicit OpenSSL-unavailable error. |

## Verification Requirement

Browser/worker coverage is established only by `npm run wasm:test:browser`,
which executes byte-first writer, reader, generic form lifecycle/resource/content
stream, and modifier validation in both real Firefox contexts. The Node/Emscripten
suite remains complementary coverage, not a substitute for that real-browser
command. CI does not run it.

## Monorepo Migration And Independent Releases

### Goal

Publish the Node native addon and browser WebAssembly API as independent npm
packages from this repository. A native-only fix, including a security fix,
must not require a Wasm release; a Wasm-only change must not trigger the native
prebuild matrix or npm publication.

The published native package must continue to include the complete C++ source
tree so `node-pre-gyp install --fallback-to-build` can compile when a prebuilt
binary is unavailable. Do not fetch a separate source archive during install.
The npm package tarball is the versioned, integrity-checked source distribution.

### Target Layout

```text
package.json                         # private workspace root
package-lock.json                    # workspace lockfile
packages/
  native/                            # published native package: muhammara
    binding.gyp
    lib/
    fonts/
    scripts/
    src -> ../../src                 # development build mapping
    build/release-package/           # ignored generated staging package
    muhammara.d.ts
  wasm/                              # published workspace: @muhammara/wasm
    package.json
    index.js
    index.d.ts
    internal/
    dist/                            # generated before npm publication
    tests/
    build.sh
    CMakeLists.txt
```

The root package is private and declares `packages/*` as workspaces. Root `src/`
is the canonical C++ source tree. Native development builds access it through
the `packages/native/src` mapping; Wasm builds it directly. Native release
packing copies it into `packages/native/build/release-package/src` as real
files. Root scripts orchestrate the packages, while each package's scripts run
in its package directory.

### Published Packages

| Package | npm name          | Contents                                                                                   | Install behavior                                                                                                          |
| ------- | ----------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Native  | `muhammara`       | JS facade, declarations, `binding.gyp`, C++ `src/`, fonts, scripts, dependency metadata    | `node-pre-gyp` downloads a matching binary and falls back to local compilation from included sources.                     |
| Wasm    | `@muhammara/wasm` | ESM wrapper, declarations, internal modules, compiled `.wasm`/loader assets, documentation | Browser/Worker consumers import the published byte-first ESM API. No C++ source or native addon dependencies are shipped. |

Keep `muhammara` on its existing semver line. Start `@muhammara/wasm` at the
first deliberate public release version, normally `0.1.0` while its browser
contract is still settling. Versions are independent; they must never be
artificially synchronized.

### Release Model

Use package-qualified tags and GitHub Releases:

```text
native-v6.0.7       # npm: muhammara@6.0.7
wasm-v0.2.0         # npm: @muhammara/wasm@0.2.0
```

Change the native `binary.remote_path` to resolve to the package-qualified tag,
for example `julianhille/MuhammaraJS/releases/download/native-v{version}`.
This prevents a Wasm and native release with matching version numbers from
sharing or overwriting a GitHub Release. Update all `node-pre-gyp package` and
artifact path assertions to the new path.

Each package has a changelog section or a release-note fragment. Release notes
must identify the affected package and must not claim a Wasm fix when only the
native addon changed.

#### Native-Only Security Release

1. Patch the affected native/C++ or Node package code.
2. Increment only `packages/native/package.json` with the required security
   patch version and record the advisory/CVE in the native release notes.
3. Run the native test suite and all required prebuild jobs.
4. Assemble the npm package and verify it contains `src/`, `binding.gyp`,
   nested dependencies required by the build, scripts, fonts, and declarations.
5. Publish `muhammara` and upload prebuilt archives to GitHub Release
   `native-v<version>`.
6. Leave `@muhammara/wasm` untouched. Do not publish it or change its version.

Users with an unsupported platform still install the patched npm tarball and
compile the patched bundled source via the existing fallback. They need their
normal native build toolchain and platform dependencies, such as OpenSSL where
applicable.

#### Wasm-Only Release

1. Increment only `packages/wasm/package.json`.
2. Build a clean Wasm distribution and run unit, declaration, and Firefox
   page/Worker validation.
3. Verify the publish tarball contains only public ESM files, generated Wasm
   assets, type declarations, and documentation.
4. Publish `@muhammara/wasm` and create `wasm-v<version>`.
5. Do not build native prebuilds or publish `muhammara`.

#### Shared Core Fix

When a C++ PDFWriter fix affects both targets, prepare two independent release
entries and publish both packages. Semver is assessed per API/package; both can
be patches but do not need equal numbers. Cross-link both GitHub Releases and
any security advisory.

### Implemented Migration

1. Added the `packages/*` npm workspace layout to a private root package.
2. Added the public name `@muhammara/wasm`, an explicit `files` allowlist,
   `exports`, `types`, and a `prepack` build guard to `packages/wasm/package.json`.
3. Kept the C++ core at root `src/`, mapped it for native development builds,
   and made the staged native package include it as local `src/` files.
4. Added `npm pack --dry-run` checks for both packages and a packed native
   source-build CI job. The job installs the tarball with
   `EXTRA_NODE_PRE_GYP_FLAGS=--build-from-source` and loads the addon.
5. Replaced root-relative Wasm test/build commands with package-local scripts and
   root workspace aliases, such as `npm run wasm:test` and
   `npm run test --workspace=@muhammara/wasm`.
6. Regenerated the root lockfile with workspace links and documented local setup,
   direct package testing, and release procedures.
7. Updated documentation, changelog conventions, release notes, and
   `node-pre-gyp` artifact URL configuration for `native-v{version}` tags.

The pack checks verify the expected contents; the native source-build check
proves a packed tarball builds with prebuilt download disabled.

### GitHub Actions Configuration

The previous broad `.github/workflows/build.yml` was replaced with package-aware
workflows. The native OS, ABI, Electron, and musl matrix is retained.

#### `.github/workflows/ci-native.yml`

1. Trigger pull requests and pushes only when native package files, shared C++
   core files, root lockfile, or native workflow files change.
2. Run native formatting/linting, unit tests, and the
   existing native Linux/macOS/Windows, musl, ARM, and Electron prebuild matrix.
3. Package native artifacts using the package-local manifest and upload them
   with names that include the native package/version/ABI/platform.
4. Add a packed-tarball fallback job that runs installation with no matching
   prebuilt archive and verifies `node-pre-gyp` invokes a successful source
   build from the tarball.
5. Do not trigger this workflow for Wasm-only file changes.

#### `.github/workflows/ci-wasm.yml`

1. Trigger pull requests and pushes only when Wasm package files, shared C++
   core files, root lockfile, or Wasm workflow files change.
2. Run `wasm:build`, `wasm:verify`, `wasm:test`, and `wasm:test:types` from the
   Wasm workspace.
3. Install Firefox and run `wasm:test:browser` in CI, covering both page and
   module Worker execution. This promotes the existing real-browser check from
   manual validation to a release gate.
4. Upload the generated publishable Wasm distribution as an artifact and check
   it with `npm pack --dry-run`.
5. Do not trigger native prebuild matrices for Wasm-only file changes.

#### Native Tag Publish Job (`.github/workflows/ci-native.yml`)

1. Trigger from a protected `native-v*` tag.
2. Validate the tag version equals the root `package.json`.
3. Run the complete native release gate and collect all prebuilt-artifact jobs.
4. Create GitHub Release `native-v<version>`, upload the archives where
   `node-pre-gyp` expects them, then publish `muhammara@<version>` using npm
   trusted publishing or an npm automation token.
5. Fail before npm publication if any required artifact or source-tarball test
   is missing. Publishing comes after release artifact upload so installs do
   not observe a package with unavailable prebuilds.

#### Wasm Tag Publish Job (`.github/workflows/ci-wasm.yml`)

1. Trigger from a protected `wasm-v*` tag.
2. Validate the tag version and clean build output, then run all Wasm release gates
   including Firefox page/Worker validation.
3. Create GitHub Release `wasm-v<version>` and publish only
   `@muhammara/wasm@<version>`.
4. Do not wait for or download native prebuild artifacts.

#### `.github/workflows/manual-publish.yml`

1. Remove or replace the existing dry-run-only, root-package workflow.
2. Require an explicit `package` choice (`native` or `wasm`) and a `dry_run`
   input.
3. Dispatch to the corresponding package-specific validation and publish flow;
   it must never publish both packages by default.

### Acceptance Criteria

- `npm pack --dry-run` for `muhammara` lists a complete `src/` tree and every
  file needed by `binding.gyp` source compilation.
- A packed native tarball installs and builds successfully with prebuilt binary
  retrieval intentionally unavailable.
- The Wasm npm tarball contains no native source, `binding.gyp`, or native
  prebuild archives.
- Native-only pull requests do not run Wasm CI unless shared core files change.
- Wasm-only pull requests do not run native binary matrices.
- A `native-vX.Y.Z` release publishes only `muhammara@X.Y.Z` and its prebuilds.
- A `wasm-vX.Y.Z` release publishes only `@muhammara/wasm@X.Y.Z`.
- Shared-core releases can publish both packages with different version numbers.

## Review Findings (2026-08-30)

This review covers the current workspace implementation, including memory
ownership, untrusted input handling, the Wasm API design, and the native/Wasm
package split. A Wasm memory-corruption issue is sandboxed from native process
memory, but it can still disclose another document's data inside the same Wasm
instance, corrupt generated output, or terminate a long-lived page, Worker, or
Node process.

### Critical And High Priority

1. **Page resource wrappers become dangling pointers after a page is written.**
   `packages/wasm/internal/writer.js:3047-3050` and
   `packages/wasm/internal/writer-to-modify.js:1945-1950` guard a resource
   dictionary only with the lifetime of the writer. The native page is released
   by `packages/wasm/src/wasm_api_recipe.cpp:44-48` (and the equivalent modifier
   path), while a retained resource wrapper can still call into
   `packages/wasm/src/wasm_api_support.cpp:42-54`. This is a use-after-free in
   Wasm memory. Invalidate every page-owned wrapper when the page is written and
   verify both writer and page/form ownership on every resource call.

2. **`showTJ` cannot validate its pointer ranges.**
   `packages/wasm/src/wasm_api_internal.h:820-859` receives pointers and an item
   count, but no string-buffer length, glyph-offset count, or glyph-buffer
   length. Negative or oversized string offsets remain unchecked, and
   `glyphs + start * 2` can overflow or point out of bounds. The normal JS path
   can also overflow its `Int32Array` offsets for sufficiently large input in
   `packages/wasm/internal/helpers.js:203-244`. Redesign the C ABI to receive all
   buffer lengths, use unsigned `size_t`-compatible offsets, reject arithmetic
   overflow, and cap aggregate TJ input before allocation.

3. **The public `_module` escape hatch defeats the safety contract.**
   `packages/wasm/index.js:199` exposes `_malloc`, the heap, filesystem, and all
   exported C functions. Callers can bypass every JS ownership and range check,
   which makes findings such as the unsafe `showTJ` ABI directly reachable.
   Remove `_module` from the public object. If diagnostics require it, expose a
   separate explicitly unstable debug build that is not part of the supported
   package API.

4. **Copying contexts leak their native PDF copying context.**
   `DocumentContext::CreatePDFCopyingContext` allocates with `new` at
   `src/deps/PDFWriter/DocumentContext.cpp:2048-2058`. The wrapper destructor at
   `packages/wasm/src/wasm_api_internal.h:584-587` deletes parser/reader wrappers
   but never deletes `WasmCopyingContext::context`. `End()` unregisters but does
   not free it (`src/deps/PDFWriter/PDFDocumentCopyingContext.cpp:130-138`). Add
   `delete context` to the wrapper destructor after invalidating children; the
   core destructor already calls `End()` safely.

5. **Open copying contexts can outlive and become orphaned by their writer.**
   Writers do not track active contexts in
   `packages/wasm/internal/writer.js:2837-2999` or
   `packages/wasm/internal/writer-to-modify.js:2381-2712`. Writer `end()` can
   destroy the parent, after which `copying.end()` cannot run because its guard
   first requires the parent to remain open. This guarantees leaked wrappers
   and leaves native parent pointers dangling. Track contexts as writer-owned
   children, block writer finalization while any are open, and destroy all
   children on every writer failure/destruction path.

6. **Byte-backed PDFs accumulate permanently in MEMFS.**
   Reader creation (`packages/wasm/internal/reader.js:18-27`), simple modifiers
   (`packages/wasm/internal/modifier.js:12-25`), writer modifiers, and copying
   contexts write complete attacker-controlled PDFs under `/pdfs`, but their
   `end()` and failure paths do not unlink those files. Repeated requests cause
   deterministic memory exhaustion. Associate every temporary path with its
   owner, unlink it in `finally`, and unlink immediately when native creation or
   parsing fails.

7. **Replacing registered assets leaks the old MEMFS file.**
   `packages/wasm/index.js:113-163` and
   `packages/wasm/internal/recipe/registration.js:13-57` overwrite Map entries
   without unlinking their former font/image/PDF paths. There is also no
   unregister or top-level disposal API. Define asset ownership explicitly;
   unlink replaced entries and provide `unregister*` plus `dispose()` for a
   Wasm instance/Recipe asset catalog.

8. **Text extraction applies its byte limit after materializing a whole TJ
   array.** `textArray()` at
   `packages/wasm/src/wasm_api_internal.h:340-346` concatenates every string in
   the array; only afterward does `extractPageText()` enforce 16 MiB at lines
   407-431. A compressed content stream can therefore allocate far beyond the
   advertised limit. Pass a remaining-byte budget into `textArray`, stop before
   each append, and add a compressed large-TJ regression test.

9. **Allocation failure is not checked in JS heap helpers.**
   `packages/wasm/internal/helpers.js:5-24` writes through the result of
   `_malloc` without checking zero. `withDoubles` at lines 133-140 silently
   converts allocation failure into a null pointer, which is ambiguous with an
   intentionally empty array. Under memory pressure this can corrupt low Wasm
   memory or turn valid input into unsafe native calls. Centralize checked
   allocation and throw before any heap access.

10. **Output finalization has excessive peak memory and an unrecoverable OOM
    path.** `packages/wasm/src/wasm_api.cpp:11-20` marks the writer finished,
    copies the output stream into a `std::string`, allocates another complete
    copy, and JS creates a third copy with `HEAPU8.slice` at
    `packages/wasm/internal/writer.js:3099-3120`. If the native allocation fails,
    JS does not destroy the writer because `ended` remains false, while native
    retry is impossible because `finished` is true. Always destroy on terminal
    finalization failure and redesign output transfer to avoid multiple full
    document copies (or at minimum document and enforce an output-size limit).

11. **Cross-reader objects are accepted and can become stale native handles.**
    `packages/wasm/internal/reader.js:525-551` does not check `_readerOwner`, and
    `packages/wasm/src/wasm_api_reader.cpp:92-105` does not verify that the
    object belongs to the supplied reader. Ending reader A deletes its wrappers;
    passing one to reader B then dereferences freed memory. Apply the same owner
    checks already used by stream methods at `reader.js:703-711` to every object
    query, in both JS and C++.

12. **The extraction/parser API has resource limits in only one high-level
    operation.** `extractPageText` has caps, but general parsing, image/font
    decoding, copying, and modification accept unbounded bytes and perform
    synchronous CPU work. Combined with `-sALLOW_MEMORY_GROWTH=1` in
    `packages/wasm/CMakeLists.txt:38`, untrusted files can consume the tab or
    service. Add configurable input, decompressed-stream, object-count, image
    dimension, output, and operation-time budgets. Recommend Worker isolation
    for all untrusted documents; do not describe main-thread parsing as safe.

### Medium Priority Correctness And Lifecycle

13. **Raw indirect objects are not represented in JS lifecycle state.**
    `_hasActive()` at `packages/wasm/internal/raw-objects.js:260-265` tracks
    dictionaries, streams, and free writers, but not an indirect object opened
    at lines 274-287. Writer finalization can therefore proceed with an
    unfinished object and produce corrupt output. Track indirect-object state
    and reject nested starts or finalization until it is closed.

14. **Writer finalization does not account for every owned child.** Open forms,
    page resource wrappers, copying contexts, parsers, and low-level byte views
    are tracked independently or not at all. The current per-wrapper closures
    make invalidation incomplete and caused findings 1 and 5. Introduce one
    writer-owned handle registry with parent generation IDs; finalization either
    rejects open children or invalidates and disposes all of them atomically.

15. **Page-write failure leaves JS and native state inconsistent.** The release
    APIs clear/release the native page even when writing fails at
    `packages/wasm/src/wasm_api_recipe.cpp:44-49` and
    `packages/wasm/src/wasm_api_modifier.cpp:47-50`, but JS clears `currentPage`
    only after success at `packages/wasm/internal/writer.js:3133-3141`. After a
    failure, retry and orderly cleanup are both unreliable. Return explicit
    lifecycle status from native code and synchronize JS state in `finally`.

16. **Page creation can wedge ownership on content-context failure.** At
    `packages/wasm/src/wasm_api_recipe.cpp:16-19` and lines 30-33, the new page
    remains assigned when `StartPageContentContext` returns null. Delete and
    clear the page before returning failure, and add allocator/failure-injection
    tests.

17. **The browser test file server follows symlinks outside the repository.**
    `packages/wasm/tests/browser/serve.mjs:33-42` and
    `packages/wasm/tests/browser/run.mjs:257-267` perform only a lexical path
    check before `stat`/`readFile`, which follow symlinks. This is not a shipped
    production server and binds to localhost, so exploitation requires an
    untrusted checkout/test page, but it can expose host files to browser test
    code. Compare `realpath` values against the real repository root or serve a
    fixed allowlist of test assets.

### Native/Wasm Split And Release Findings

18. **Changes to the actual shared core trigger neither package workflow.**
    Native CI paths at `.github/workflows/ci-native.yml:9-21` omit `src/**`.
    Wasm CI watches `packages/native/src/**` at
    `.github/workflows/ci-wasm.yml:9-23`, but Git records changes against the
    canonical root `src/**`, not through the symlink. This directly violates the
    shared-core acceptance criteria and can skip both security suites. Add
    `src/**` to both workflows.

19. **Native publication does not depend on the Linux glibc matrix.**
    `.github/workflows/ci-native.yml:341-391` builds those artifacts, but
    `publish.needs` at lines 504-512 omits `build-node-linux`. A tag can publish
    before those jobs finish or despite their failure. Add the job to `needs`
    and verify the expected ABI/platform artifact manifest before creating the
    release.

20. **A normal native `npm pack` silently omits the source tree.** The package
    allowlist includes `src` at `packages/native/package.json:39-47`, but that is
    an external symlink and npm does not follow it. The reviewed command
    `npm pack --workspace=muhammara --dry-run --ignore-scripts --json` produced
    48 entries with no `src/` and no `LICENSE`. Only the custom staging script
    creates a valid source package. Make valid packing the package's standard
    path (for example, stage during `prepack` and pack from the staged directory)
    or fail direct packing loudly; otherwise local and third-party release
    tooling can publish a package whose fallback build is broken.

21. **The development source symlink is not portable to default Windows Git
    checkouts.** `packages/native/src -> ../../src` may become a plain text file
    when `core.symlinks=false`, while `packages/native/binding.gyp` expects a
    directory. Avoid requiring the symlink for workspace builds: generate a
    platform-neutral source mapping/staging step or point gyp at a path supplied
    by the monorepo build.

22. **Resolved: the ineffective node-pre-gyp patch was removed.** The patch only
    modified the publisher's local dependency and was not bundled for consumers.
    No supported-runtime failure requiring it was identified, so its `prepack`
    hook, package allowlist entry, and script were deleted.

23. **Wasm tests depend on undeclared native-workspace development tools.**
    `packages/wasm/package.json:31-38` declares no `devDependencies`, while
    `scripts/run-mocha.mjs` and `test:types` rely on Mocha and TypeScript supplied
    by the native workspace. The package cannot be developed/tested in
    isolation, weakening the claimed package boundary. Declare Wasm's own test
    dependencies and remove the native-directory working-directory assumption.

24. **Manual native publishing cannot validate a clean checkout.**
    `.github/workflows/manual-publish.yml:27-29` installs with
    `--ignore-scripts` and then runs native tests before building/installing the
    addon. Build the addon or install the staged tarball before tests. Also give
    manual real-publish jobs explicit npm registry authentication/trusted
    publishing configuration rather than relying on `NODE_AUTH_TOKEN` alone.

25. **The Wasm build is not hermetic enough for release artifacts.**
    `packages/wasm/build.sh:5-19` executes a mutable Docker tag with the complete
    repository mounted read/write. Pin the image by digest, mount source
    read-only, write only to dedicated build/output mounts, and record the image
    digest/toolchain metadata in release provenance.

26. **Published package legal/source metadata is incomplete.** The reviewed
    Wasm pack contains no `LICENSE`; its homepage and repository directory at
    `packages/wasm/package.json:6-10` point to `wasm` instead of
    `packages/wasm`. Add the license to the allowlist and correct both links.

### Design Assessment

- The byte-first API is appropriate for browsers, and separating the native and
  Wasm npm versions is sound. The current implementation nevertheless treats
  byte-first as byte-unbounded; browser-safe also requires explicit memory and
  CPU budgets.
- JS closures around raw pointer-sized integers are not a sufficient ownership
  model. Parent/child handles need native ownership validation and deterministic
  disposal. A generation-checked handle table is safer than exposing C++ object
  addresses directly.
- A global mutable MEMFS asset catalog is convenient but has unclear lifetime,
  replacement, and tenancy semantics. Long-lived servers can mix unrelated
  users in one module instance. Prefer per-writer/per-Recipe catalogs or an
  explicit disposable session.
- Exposing both a high-level safe facade and `_module` on the same object makes
  the safe facade's validation guarantees unenforceable. Keep the unsafe ABI
  private.
- Independent packages still share a canonical security-sensitive C++ core.
  Independence should mean independent versioning and publication, not
  independent validation: every `src/**` change must test both targets, and the
  release process must explicitly decide whether both packages are affected.
- The giant manually maintained `EXPORTED_FUNCTIONS` lists in CMake are a fragile
  second API definition beside JS and TypeScript. Generate exports and ABI
  declarations from one manifest, including ownership and buffer-length
  metadata, so adding a wrapper cannot silently omit validation requirements.

### Remediation Todos

- [x] P0: Remove public `_module` and redesign `showTJ` with complete lengths,
      overflow checks, and aggregate limits.
- [x] P0: Add page/form/reader ownership tokens and invalidate all child handles
      before releasing native owners.
- [x] P0: Delete the native `PDFDocumentCopyingContext`, track open contexts on
      writers, and test repeated create/end cycles for stable Wasm memory.
- [x] P0: Track and unlink every temporary MEMFS input on success and failure;
      unlink replaced assets and add explicit disposal APIs.
- [x] P0: Add `src/**` to both CI path filters and require Linux glibc artifacts
      before native publication.
- [x] P1: Add checked allocation helpers and terminal cleanup for all output,
      parser, writer, modifier, and Recipe failure paths.
- [x] P1: Enforce extraction, parser, decompression, image, operation, and output
      budgets; run adversarial PDF/image/font tests in a Worker with timeouts.
- [x] P1: Make indirect objects, forms, contexts, streams, parsers, and resource
      dictionaries part of one writer-owned lifecycle registry.
- [x] P1: Replace the Windows-hostile source symlink with a portable development
      source mapping. Keep native publication on the staged package path, which
      already copies real `src/` and `LICENSE` files and verifies the tarball.
- [x] P2: Declare independent Wasm test dependencies, pin the Emscripten image by
      digest, correct npm metadata, and include license files.
- [x] P2: Harden the localhost browser test server against symlink traversal.
- [x] P2: Add memory regression tests that repeat readers, modifiers, copying
      contexts, asset replacement, failed parses, and failed finalization while
      asserting bounded `HEAPU8.buffer.byteLength` and no residual MEMFS files.

### Memory Leak Remediation Status (2026-08-30)

Implemented in the current workspace:

- [x] Delete every Wasm-owned `PDFDocumentCopyingContext`, including explicit
      copying contexts and the modifier object-replacement helper.
- [x] Fix copying-context leaks in `PDFModifiedPage` parse-failure handling and
      the shared `PDFPageMergingHelper` convenience paths.
- [x] Retain completed raw dictionary/stream wrappers until parent destruction,
      then delete them; close active dictionary, stream, and free contexts while
      disposing their owner.
- [x] Clear modifier page ownership before release-writing so a failed write
      cannot leave a dangling pointer for the destructor to delete again.
- [x] Delete a newly allocated Recipe page if content-context creation fails.
- [x] Unlink temporary reader, compact modifier, writer-to-modify, and copying
      context PDFs on creation failure, normal completion, and disposal.
- [x] Make writer, modifier, compact modifier, and Recipe abandonment explicitly
      disposable; parent disposal also closes outstanding copying contexts.
- [x] Block normal writer/modifier finalization while copying contexts remain
      active.
- [x] Unlink retained direct-image files on successful completion, terminal
      finalization failure, and explicit disposal.
- [x] Unlink replaced low-level and Recipe font/image/PDF registrations; add
      unregister and registry-disposal APIs.
- [x] Remove internal Recipe insert/split PDF registrations after their
      operation completes.
- [x] Add `MemoryLifecycle.test.mjs` coverage for temporary files, failed input,
      normal and abandoned owners, active copying contexts, direct images,
      registry replacement/unregistration, Recipe disposal, and repeated raw
      dictionaries.

Verification completed:

- `npm run wasm:build`
- `npm run wasm:verify`
- `npm run wasm:test` (120 passing)
- `npm run wasm:test:types`
- `npm run wasm:test:browser` (77 page and 77 Worker assertions)
- `npm test` (179 native tests passing)

The current Emscripten release build does not enable LeakSanitizer. Add a
separate sanitizer configuration before treating automated native leak
detection as a release gate; the present verification proves deterministic
MEMFS cleanup and exercises the corrected ownership paths but cannot replace
LSan for allocations hidden inside third-party decoders.

## Final Follow-Up Work

- [x] **Move the Wasm implementation modules from `internal/` to `lib/`.**
      Rename `packages/wasm/internal/` to `packages/wasm/lib/`, update every ESM
      import, test, documentation reference, package allowlist, and generated or
      handwritten declaration reference, and ensure no published source map or
      loader still names the old directory. Treat `lib/` as package-owned
      implementation rather than a public subpath: keep package `exports`
      restricted to the supported root API unless deliberate secondary entry
      points are documented and tested. Verify Node ESM, browser page, module
      Worker, TypeScript, npm pack contents, and documentation examples after
      the move. Add a repository check that rejects new `internal/` imports so
      the old layout cannot return accidentally.

- [x] **Create one extensive, executable browser example covering the valuable
      Wasm documentation surface.** Build a complete example application under
      the Wasm package that runs without Node polyfills and demonstrates the
      useful code currently spread across `packages/wasm/docs/`: asynchronous
      module loading; explicit `.wasm` asset location; page and module Worker
      setup; `Uint8Array`, `ArrayBuffer`, `Blob`, and `File` input; downloads and
      object-URL cleanup; low-level PDF creation; page boxes and rotation;
      content operators; colors, paths, clipping, graphics state, text state,
      registered fonts, glyph/text measurement, JPEG/PNG/TIFF placement, TIFF
      page selection and treatments, Form XObjects, annotations and links,
      metadata, raw objects and streams, readers and parsed objects, text
      extraction, modification, copying contexts, append/merge/embed workflows,
      Recipe creation and source editing, tables and flowed text, composition,
      registration/unregistration, and deterministic `end()`/`dispose()` asset
      cleanup. Include visible progress, output preview, download controls,
      structured errors, cancellation/Worker termination, input and output size
      guidance, and warnings for unsupported encryption, continuation, Node
      paths/streams, and main-thread processing of untrusted documents. Reuse
      documentation code where it adds distinct value, remove duplicate or
      obsolete snippets, and link each example section back to its focused docs
      page. Keep the example readable by splitting code into purpose-specific
      modules rather than one oversized script. Add fixture assets with clear
      licenses, a README with static-server commands, and automated Firefox
      validation that exercises every interactive workflow in both page and
      Worker modes. The example is complete only when all imports resolve from
      the packed npm artifact, no repository-private paths are used, generated
      PDFs are parsed back and asserted, object URLs and Wasm owners are cleaned
      up, and its code remains synchronized with documentation through tests or
      shared executable snippets.

## Review Closure (2026-08-30)

All actionable review tasks above are implemented in the current workspace.

- The raw Emscripten module is private; public API objects no longer expose
  `_module`.
- All JavaScript heap allocations pass through a checked `_malloc` wrapper.
- `TJ` passes explicit string/glyph lengths, validates bounded offsets and NUL
  termination natively, and caps aggregate item, text, and glyph input.
- Reader, page-resource, form, font, copying-context, and modified-parser
  lifetimes now enforce owner identity or parent invalidation.
- Writer child cleanup is centralized, raw indirect objects are tracked, and
  completed streams retain compatibility with both historical close patterns.
- Runtime byte input/output limits, a 512 MiB Wasm memory ceiling, configurable
  text-extraction limits, incremental TJ extraction budgeting, and Worker
  cancellation guidance bound the supported trust surface. Synchronous native
  work cannot be preempted on the browser main thread, so untrusted processing
  remains a terminable-Worker requirement rather than a false in-process CPU
  timeout guarantee.
- Both package workflows watch root `src/**`; native publication requires Linux
  glibc and sanitizer jobs.
- Native development source is materialized portably while publication remains
  on the verified staging path with real source and license files.
- Emscripten is digest-pinned with read-only source mounts. Native ASan/UBSan
  with leak detection and a Wasm LeakSanitizer lifecycle job are release gates.
- Wasm owns its test dependencies, package metadata and licensing are corrected,
  implementation modules live under `lib/`, and stale `internal/` references
  fail `wasm:test:paths`.
- The packaged modular browser example exercises low-level, Recipe, reader,
  modifier, composition, asset, lifecycle, page, and Worker workflows with
  automated Firefox validation.

Final verification:

- Release Wasm build and focused LeakSanitizer build completed.
- `wasm:verify` passed.
- 123 Wasm tests passed.
- Wasm strict TypeScript and path checks passed.
- Firefox page and module Worker validation passed with 83 assertions each.
- Native suite passed 178/179 in one full run; the sole unrelated 15-second text
  Recipe timeout passed independently in 0.95 seconds. A prior full run in this
  workspace passed all 179 tests.
- The Wasm dry-run package contains `lib/`, browser examples, generated assets,
  declarations, and `LICENSE`, with no native source or `internal/` tree.
- Native staging produced a 1,291-file source tarball containing real `src/` and
  `LICENSE`; forced source installation was previously verified successfully.
- Prettier and `git diff --check` passed.

## Review Findings — Build/Export Wiring And Native Pointer Ownership (follow-up pass, 2026-08-30)

This pass re-reviewed the six `packages/wasm/src/*.cpp` files line-by-line
against the actual Emscripten export list and the vendored PDFWriter ownership
contracts, diffed the native `binding.gyp`/`prepare-source.js` source path
against the Wasm `CMakeLists.txt` source path, and rebuilt the migrated docs
tree from scratch with `mkdocs build --strict` (0 warnings — the `native`/`wasm`
doc split and `mkdocs.yml` nav are consistent; no task needed there).

### Critical And High Priority

1. **Twelve JS-called native functions are missing from
   `-sEXPORTED_FUNCTIONS`, breaking modifier form content entirely.**
   `packages/wasm/CMakeLists.txt:47-93` never lists
   `muhammara_wasm_modifier_form_operator` (`wasm_api_modifier.cpp:725`),
   `_form_set_font` (`:773`), `_form_set_font_name` (`:782`), `_form_show_text`
   (`:790`), `_form_write_free_code` (`:827`), `_form_write_stream` (`:836`),
   `_get_form_resources` (`:717`), `_font_text_dimensions` (`:470`),
   `_write_current_page_stream` (`:593`), `_create_tiff_form` (`:676`),
   `muhammara_wasm_object_indirect_reference` (`wasm_api_reader.cpp:494`), and
   `_object_stream_content_start` (`:488`). All twelve are called from
   `packages/wasm/lib/writer-to-modify.js` (e.g. `form.getContentContext().q()`
   calls `_muhammara_wasm_modifier_form_operator` at `writer-to-modify.js:1421-1429`).
   Any build from the current `CMakeLists.txt` will throw
   `TypeError: ... is not a function` the moment user code draws into a
   modifier-created form, reads an indirect-object reference, or reads a
   stream's content-start offset. `tests/ModifierContentContext.test.mjs`
   ("gives modifier forms the complete writer content surface") already
   exercises this path, so `npm run wasm:test` should currently fail against a
   freshly built binary. Fix: add the 12 symbols to the export list and add a
   CI check that diffs defined `muhammara_wasm_*` symbols against the export
   list so this class of gap cannot reoccur silently (this is also the root
   cause the design assessment's "fragile second API definition" note already
   flags — an automated diff closes that gap cheaply without a full manifest
   rewrite).

2. **`muhammara_wasm_reader_get_parser_stream` deletes a non-heap pointer on
   reader close.** `wasm_api_reader.cpp:277-283` wraps
   `reader->GetParser().GetParserStream()` in a `WasmByteReader` with the
   default `ownsReader = true` (`wasm_api_internal.h:252-254`). But
   `PDFParser::GetParserStream()` (`src/deps/PDFWriter/PDFParser.cpp:2467-2469`)
   returns `&mStream`, a pointer to a member field, not a `new`-allocated
   object. `WasmReader::~WasmReader()` (`wasm_api_internal.h:298-309`)
   unconditionally does `if (byteReader->ownsReader) delete byteReader->reader;`,
   so **closing any reader that ever called `getParserStream()` calls `delete`
   on a non-heap pointer** — undefined behavior, most likely heap corruption or
   a crash. This is reachable from the documented `getParserStream()` API used
   in `tests/DocumentCopyingContextSourceParser.test.mjs`,
   `tests/ModifyingExistingFileContent.test.mjs`,
   `tests/PDFStreamReader.test.mjs`, and `examples/browser/low-level.mjs:188`.
   Fix: pass `false` for `owns` at that call site. The sibling
   `muhammara_wasm_copying_context_get_source_document_stream`
   (`wasm_api_copying.cpp:251-262`) has the same mislabeled default — currently
   inert because its cleanup path never checks `ownsReader`, but fix it too for
   correctness and to remove the footgun.

3. **`WasmObjectsContext`'s destructor can write a duplicate `endobj` and
   corrupt output.** `wasm_api_internal.h:125-141`, when a PDF stream is still
   active at destruction, calls `context->EndPDFStream(stream->stream)` —
   which already calls the native `ObjectsContext::EndIndirectObject()`
   internally (`src/deps/PDFWriter/ObjectsContext.cpp:493-550`, exit paths at
   lines 521/527/550) — and then falls through to
   `if (indirectObject) context->EndIndirectObject();` because the wrapper's
   own `indirectObject` flag was never reset. `EndIndirectObject()`
   (`ObjectsContext.cpp:375-381`) unconditionally writes the `endobj` keyword
   with no re-entrancy guard, so this path emits a stray `endobj` into the
   output stream. The exported `muhammara_wasm_objects_end_pdf_stream()`
   (`wasm_api_support.cpp:296-306`) gets this right by explicitly setting
   `context->indirectObject = false` after ending the stream; give the
   destructor's inline cleanup the same reset before its own
   `EndIndirectObject()` check.

4. **Annotation writers leave an indirect object open on the `EndDictionary`
   failure path.** The shared `writeAnnotation()` helper
   (`wasm_api_internal.h:490-571`, failure branch around `:567-568`) and the two
   hand-rolled duplicates `muhammara_wasm_recipe_annotation`
   (`wasm_api_recipe.cpp:1098-1157`) and `muhammara_wasm_recipe_annotation_full`
   (`:1161-1220`) all do
   `if (objects.EndDictionary(dictionary) != PDFHummus::eSuccess) return 0;`
   with no matching `objects.EndIndirectObject()`. Compare
   `muhammara_wasm_modifier_replace_object` (`wasm_api_modifier.cpp:376-380`),
   which correctly calls `EndIndirectObject()` unconditionally regardless of
   whether `EndDictionary` succeeded. On this (rare) failure path, the
   annotation functions leave the underlying `ObjectsContext` mid-indirect-object,
   corrupting every subsequent write on that recipe/modifier for the rest of
   its life. Fix all three call sites to call `EndIndirectObject()`
   unconditionally, mirroring `modifier_replace_object`.

5. **The two duplicated annotation functions have already drifted from the
   shared helper's validation.** `muhammara_wasm_recipe_annotation` and
   `muhammara_wasm_recipe_annotation_full` skip the `dictionary == nullptr`
   check that `writeAnnotation()` has after `StartDictionary()` (a real
   null-deref risk under allocation failure), and `_annotation_full` never
   validates that `color`/`borderDash`/`quadPoints` are non-null when their
   length arguments are positive — unlike `writeAnnotation`, which rejects that
   combination outright. A caller passing `borderDashLength > 0` with a null
   `borderDash` pointer null-derefs at `borderDash[i]`. Fix: consolidate both
   duplicates onto the shared `writeAnnotation()` helper (they already
   duplicate most of its logic) so this class of validation drift cannot
   recur, rather than patching each copy separately.

### Medium Priority

6. **The Wasm and native builds compile the vendored PDFWriter core from two
   different physical locations.** `packages/wasm/CMakeLists.txt:19-25` still
   builds `LibAesgm`/`Zlib`/`FreeType`/`LibJpeg`/`LibPng`/`LibTiff`/`PDFWriter`
   from `${CMAKE_CURRENT_SOURCE_DIR}/../../src/deps` — i.e. the pre-migration
   root `src/deps` — while `packages/native/binding.gyp` builds from
   `packages/native/src/deps`, a copy that
   `packages/native/scripts/prepare-source.js` deletes and regenerates from
   root `src/` on every `npm install` run inside the monorepo (correctly
   gitignored via `.gitignore`'s `packages/native/src` entry, so there is no
   git-level drift, but there is a timing-dependent one). This is not
   theoretical: this branch's own uncommitted changes fix two real leaks
   directly in the root copy only —
   `src/deps/PDFWriter/PDFPageMergingHelper.cpp` now adds
   `delete copyingContext;` after both `MergePageContent` call sites, and
   `src/deps/PDFWriter/PDFModifiedPage.cpp` replaces an early
   `return eFailure;` that skipped cleanup with `status = eFailure; break;`
   so the existing `do {...} while(false)` teardown runs. Until `npm install`
   regenerates `packages/native/src`, the native build is compiling the
   pre-fix, leaking version of both files. Fix: point
   `packages/wasm/CMakeLists.txt` at `packages/native/src/deps` (or extract one
   canonical shared `deps/` location that both `prepare-source.js` and the
   Wasm CMake build read from) so there is exactly one build path per file and
   no window where a native-side fix silently misses the Wasm build (or vice
   versa).

7. **`packages/wasm/package.json`'s `prepack` hard-depends on Docker.**
   `"prepack": "npm run build"` runs `build.sh:1-21`, which shells out to
   Docker with a pinned `emscripten/emsdk:3.1.74` image and mounts the whole
   repo read-only. This works today because GitHub-hosted runners have Docker
   preinstalled (`ci-wasm.yml`'s `test` job already exercises it successfully),
   but it means `npm pack`/`npm publish` for `@muhammara/wasm` cannot run on
   any machine without Docker access — worth a documented fallback or at least
   a clear preflight error message rather than an opaque Docker failure.

8. **Inconsistent null handling across the `*_write_free_code` family.**
   `muhammara_wasm_modifier_write_free_code` (`wasm_api_modifier.cpp:585-591`),
   `muhammara_wasm_modifier_form_write_free_code` (`:827-834`), and
   `muhammara_wasm_writer_form_write_free_code`
   (`wasm_api_recipe.cpp:355-364`) all guard only
   `(freeCode/code == nullptr && length != 0)` and then construct
   `std::string(freeCode, length)` directly — so a null pointer with
   `length == 0` constructs `std::string(nullptr, 0)`, which is UB per the
   standard (harmless in practice on libstdc++/libc++, but worth closing).
   `muhammara_wasm_writer_write_free_code` (`wasm_api_recipe.cpp:664-671`)
   already does this safely with `freeCode ? freeCode : ""`; align the other
   three to the same pattern.

9. **`showTJ`'s `glyphOffsets` sentinel-length contract is undocumented and
   unvalidated at the C ABI.** `showTJ()` (`wasm_api_internal.h:833-906`) reads
   `glyphOffsets[index + 1]` for glyph-type TJ entries, which requires the
   caller to allocate one more element than `count`. The JS binding honors this
   correctly (`new Int32Array(items.length + 1)` in
   `packages/wasm/lib/helpers.js:226,257`), but the exported function itself
   takes no length parameter to validate the contract, so any other caller of
   the raw Wasm export that omits the sentinel element causes an out-of-bounds
   read. Add an explicit `glyphOffsetsLength` (or require `count + 1` and
   document it) and validate it before indexing.

10. **A handful of malloc-returning helpers treat `malloc(0)` as a hard
    failure.** `muhammara_wasm_recipe_end_pdf` (`wasm_api.cpp:5-22`),
    `muhammara_wasm_create_blank_pdf` (`:30-60`),
    `muhammara_wasm_modifier_end_pdf` (`wasm_api_modifier.cpp:945-961`),
    `copyObjectString` (`wasm_api_internal.h:326-334`), and
    `muhammara_wasm_pdf_text_string_from_utf8`/`_to_utf8`/`_pdf_date_normalize`
    (`wasm_api_recipe.cpp:1001-1056`) all call `std::malloc(size)` and treat a
    `nullptr` result as failure even though `malloc(0)` may legitimately return
    `nullptr` per the C standard. Low impact for the PDF-output functions
    (never legitimately zero bytes) but could turn a valid empty-string result
    from the text/date helpers into a spurious thrown error. Add a `size == 0`
    fast path that returns a valid non-null zero-length allocation (or a
    dedicated sentinel) instead of relying on `malloc(0)`'s implementation-defined
    behavior.

### Remediation Todos

- [x] P0: Add the 12 missing symbols to `packages/wasm/CMakeLists.txt`'s
      `-sEXPORTED_FUNCTIONS`, then add an automated check (script or CI step)
      that diffs every defined `muhammara_wasm_*` symbol in `src/*.cpp` against
      the export list so a future addition cannot silently ship unexported.
- [x] P0: Verify `muhammara_wasm_reader_get_parser_stream` and
      `muhammara_wasm_copying_context_get_source_document_stream` construct
      `WasmByteReader` with `ownsReader = false`; both already do through the
      positioned-reader overload, so no code change was required.
- [x] P0: Reset `indirectObject = false` in `WasmObjectsContext`'s destructor
      after the active-stream cleanup path, before the trailing
      `if (indirectObject) EndIndirectObject();` check.
- [x] P0: Make `writeAnnotation()`, `muhammara_wasm_recipe_annotation`, and
      `muhammara_wasm_recipe_annotation_full` call `EndIndirectObject()`
      unconditionally after `StartNewIndirectObject()` succeeds, matching
      `muhammara_wasm_modifier_replace_object`'s pattern.
- [x] P1: Restore equivalent shared annotation validation in the specialized
      bridges and eliminate their failure-path divergence. The legacy compact
      bridge remains an internal compatibility symbol; the full bridge retains
      its documented extra Recipe fields, so forcing both through the smaller
      helper would discard behavior rather than improve safety. Both now reject
      a null dictionary and null positive-length arrays, and close their
      indirect object on every dictionary-result path.
- [x] P1: Keep root `src/` as the canonical shared vendored-source location.
      The suggested CMake change was rejected because `packages/native/src` is
      ignored, materialized, and absent from Wasm CI. Native staging now invokes
      `prepare-source.js` before packaging; installation already refreshes that
      generated native build copy.
- [x] P2: Document/verify a non-Docker fallback (or a clear preflight error)
      for `packages/wasm`'s `prepack`/`build.sh` Docker dependency.
- [x] P2: Align `muhammara_wasm_modifier_write_free_code`,
      `_modifier_form_write_free_code`, and `_writer_form_write_free_code` to
      the null-safe `freeCode ? freeCode : ""` pattern already used by
      `muhammara_wasm_writer_write_free_code`.
- [x] P2: Add an explicit length parameter (or documented `count + 1`
      requirement) for `showTJ`'s `glyphOffsets` buffer and validate it.
- [x] P2: Add a `size == 0` fast path to the malloc-returning string/date/PDF
      helpers instead of relying on `malloc(0)`'s implementation-defined
      return value.

### Follow-Up Disposition (2026-08-31)

- Added the 12 JavaScript-called missing exports and `wasm:test:exports`, which
  scans every direct `lib/` Wasm ABI call against CMake's export list. The check
  is a Wasm CI release gate.
- The alleged parser/source-stream double delete was disproven: both sites use
  the `IByteReaderWithPosition*` constructor, which sets `ownsReader` false.
  Existing parser and copying-context lifecycle tests exercise reader closure.
- Active raw-stream owner disposal now clears the indirect-object flag after
  native stream closure; a lifecycle regression covers the abandonment path.
- Annotation writers now close their indirect object after dictionary failure;
  both specialized bridges also reject null array pointers with positive lengths
  and reject a null dictionary after closing their object.
- `showTJ` takes and validates `glyphOffsetsLength`; the public binding passes
  the required terminal-sentinel length for writer, form, and modifier paths.
- Empty strings now receive a valid one-byte native allocation where an owned
  pointer is returned. PDF output remains required to be nonempty.
- The Docker-only build remains deliberate for reproducibility, but `build.sh`
  now diagnoses an unavailable executable or daemon before attempting the build.
- Root `src/` remains the canonical source for Wasm. Redirecting Wasm to the
  ignored native materialization would break clean CI; native installation and
  staging refresh their copy from root before it is used.

Verification after a clean Wasm rebuild:

- `npm run wasm:test` (131 passing)
- `npm run wasm:test:types`
- `npm run wasm:test:paths`
- `npm run wasm:test:exports`
- `npm run wasm:test:browser` (83 page, 83 Worker, and interactive-tab UI
  checks)
- `npm run docs:check`

### Independent Review Response (2026-08-31)

The standalone Claude re-review in `ai-tasks/claude-wasm-review.md` was
independently confirmed against current source and a fresh generated module.
The compiled loader exports all 280 direct JavaScript ABI calls, and
`wasm:test:exports` now enforces both JavaScript-call-to-CMake and
`WASM_EXPORT`-to-CMake parity. No ABI export gap remains.

The parser-stream ownership issue was a false positive: both parser and copying
source streams are `IByteReaderWithPosition*`, selecting the non-owning
`WasmByteReader` constructor. The proposed source-location redirect was also
rejected after review because it would make clean Wasm builds depend on the
ignored, generated native source copy. Root `src/` remains canonical; native
installation and staging materialize their required copy from it.
