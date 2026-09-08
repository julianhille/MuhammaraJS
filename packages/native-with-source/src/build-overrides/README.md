# Native Concurrency Build Overrides

These native-only overrides let independent PDFWriter jobs execute concurrently
without editing `src/deps`. They do not change vendor class declarations, layouts,
public exports, or the Wasm build. Worker scheduling and per-job trace setup/reset
remain the responsibility of `RecryptAsync.cpp`.

## Build Design

- `pdfwriter.gyp` and `aes.gyp` declare static targets with the vendor settings
  and apply `target_defaults`. Their source lists are read from the vendor GYP
  files using node-gyp's configured Python interpreter and `ast.literal_eval`.
  Paths are relative to the wrapper; `sources!` uses those same paths.
  The generation regression checks the explicit settings against the vendor
  targets so an upstream settings change requires reviewing these wrappers.
- Do not directly include a vendor `.gyp`: the MSVS generator emits a solution
  for every loaded `.gyp`, even an include whose targets belong to the wrapper.
  That orphan solution has no project-created output directory and fails during
  configure ([#98](https://github.com/julianhille/MuhammaraJS/issues/98)). Includes
  are processed before command expansion, so generating an included `.gypi`
  inside the same wrapper would not work. Reading only the source lists avoids
  extra configure entrypoints, generated GYP copies, and vendor-tree writes.
  Rerun configure after changing a vendor source list.
- `generate.gyp` runs `generate.cjs` before compilation. Each replacement checks
  its exact expected occurrence count and fails the build on mismatches. It
  validates all patches before writing build copies under
  `build/<configuration>/obj/gen/native-build-overrides`, never under `src/deps`.
  A vendor update that changes a patch anchor requires reviewing the override.
- The small AES source/header closure is copied together. Merely adding an
  include directory would not work: quoted includes search beside the including
  vendor source/header first. All other PDFWriter sources and headers are used
  directly from the vendor tree.
- The PDFWriter wrapper depends directly on the replacement AES target. The
  original AES target is neither loaded nor linked. The replacement retains the
  distinct `muhammara_aesgm` archive name. The `--gyp` regression checks the
  effective link rule and replacement object paths, then tests the actual
  GYP-built archives.
- All helpers live under `src`, which is already included in the source package's
  shipping allowlist. Generated copies remain build artifacts.

## Concurrency Boundaries

`Trace::DefaultTrace()` is thread-local, and all trace state is initialized.
Different jobs must not pass a `Trace` instance between threads. The worker must
disable/reset its trace before and after each job so a reused pool thread cannot
retain a previous job's settings or a borrowed stream.

After PDF processing and trace cleanup, `RecryptAsync.cpp` calls
`OPENSSL_thread_stop()` on the pool thread itself. OpenSSL's per-thread RNG and
error state must be released before library shutdown, because libuv's threads
can outlive it. This is not global `OPENSSL_cleanup()`; subsequent jobs and
Node's own crypto operations can continue using OpenSSL.

One short recursive mutex protects log-file construction and each whole log
record, including timestamp, message, newline, open, flush, and close. It also
protects separate `Log` instances sharing one stream. It never surrounds PDF
parsing, cryptography, or serialization. Logging failures and reentrant log
callbacks are suppressed while inside this sink operation; a failed file open
does not dereference a null output stream. Stream ownership remains with callers.

Both log timestamps and PDF dates use caller-owned `tm` storage via
`localtime_r`/`gmtime_r` on POSIX and `localtime_s`/`gmtime_s` on Windows. Timezone
semantics are unchanged; changing process-global timezone settings concurrently
is not supported.

AES-NI's first-detection cache and VIA's repeatedly written probe flags are
thread-local C storage. MSVC VIA inline assembly writes only stack locals; C
performs the TLS accesses. This covers negative VIA detections on every call,
not just a warmup. Existing CPU selection, AES algorithms, random IV generation,
and RNG fallback behavior are otherwise unchanged.

## Verification

For build generation only, use npm's node-gyp, or pass the directory containing
node-gyp's `gyp/` explicitly:

```sh
npm exec -c 'python3 packages/native-with-source/tests/build-overrides/generation.py'
python3 packages/native-with-source/tests/build-overrides/generation.py /path/to/node-gyp
```

Native CI runs this regression before building the packed source package.

This standalone regression runs the real MSVS generator for x64 and ia32, plus
Make generation, against the package's `binding.gyp`. It uses fresh
temporary output directories (including spaces) and does not compile, run build
actions, download headers, or alter the normal build directory. MSVS uses a
virtual VS2022/Windows SDK configuration; a non-UTF-8 subprocess locale works
around GYP's MSVS XML writer on POSIX. The test sets `module_root_dir` to GYP's
per-file `DEPTH` rather than an absolute path, keeping dependency projects inside
the temporary output directory, and asserts that vendor files are untouched.
The test checks solution/project references,
compiler include paths and exception settings, replacement source selection,
the absence of original AES link dependencies, and preserved vendor metadata.
It does not replace Windows/Electron compilation or macOS runtime testing.

From the repository root, with a POSIX C/C++ toolchain:

```sh
node packages/native-with-source/tests/build-overrides/run.cjs
node packages/native-with-source/tests/build-overrides/run.cjs --aes-ni
node packages/native-with-source/tests/build-overrides/run.cjs --aes-ni --tsan
node packages/native-with-source/tests/build-overrides/run.cjs --ia32
```

`--aes-ni` explicitly enables the runtime-dispatched AES-NI build on x64, since
the default Linux build may not compile that path. `--ia32` needs a multilib
toolchain and exercises the VIA-enabled build, including recurring negative
probes on non-VIA CPUs. `--tsan` needs an installed ThreadSanitizer runtime.
`CC`, `CXX`, and `TMPDIR` are honored. The runner only executes when invoked
directly, not when Mocha discovers it, and adds no instrumentation to the addon.

The isolated harness checks simultaneous cold AES-128/192/256 known-answer
encryption/decryption, unique live trace addresses, main/worker log routing,
both trace formatting overloads with truncation-sized messages, shared stream
records, shared-file creation/BOM and long records, recursive/unwritable logging,
and date conversions in UTC and a non-UTC timezone.

From `packages/native-with-source`, configure/build the native archive overrides:

```sh
../../node_modules/.bin/node-pre-gyp configure
make -C build -j4 pdfwriter libaesgm
node tests/build-overrides/run.cjs --gyp
```

To relink the addon after the main worker changes are ready, run
`../../node_modules/.bin/node-pre-gyp build --jobs=4` from the same directory.
Use the normal Windows/macOS native builds to validate those platform branches;
the isolated runner currently targets POSIX toolchains.
