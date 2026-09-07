# Native Concurrency Build Overrides

These native-only overrides let independent PDFWriter jobs execute concurrently
without editing `src/deps`. They do not change vendor class declarations, layouts,
public exports, or the Wasm build. Worker scheduling and per-job trace setup/reset
remain the responsibility of `RecryptAsync.cpp`.

## Build Design

- `pdfwriter.gyp` and `aes.gyp` include the vendor GYP targets and apply
  `target_defaults`. GYP rebases included source paths relative to the wrapper;
  the `sources!` entries must use those rebased paths, not bare filenames.
- `generate.gyp` runs `generate.cjs` before compilation. Each replacement checks
  its exact expected occurrence count and fails the build on mismatches. It
  validates all patches before writing build copies under
  `build/<configuration>/obj/gen/native-build-overrides`, never under `src/deps`.
  A vendor update that changes a patch anchor requires reviewing the override.
- The small AES source/header closure is copied together. Merely adding an
  include directory would not work: quoted includes search beside the including
  vendor source/header first. All other PDFWriter sources and headers are used
  directly from the vendor tree.
- GYP loads dependencies before applying `dependencies!`. The excluded original
  AES target can therefore still be generated/built, but is **not linked** into
  the addon. The replacement uses the distinct `muhammara_aesgm` archive name to
  avoid output collisions. The `--gyp` regression checks the effective link rule
  and replacement object paths, then tests the actual GYP-built archives.
- All helpers live under `src`, which is already included in the source package's
  shipping allowlist. Generated copies remain build artifacts.

## Concurrency Boundaries

`Trace::DefaultTrace()` is thread-local, and all trace state is initialized.
Different jobs must not pass a `Trace` instance between threads. The worker must
disable/reset its trace before and after each job so a reused pool thread cannot
retain a previous job's settings or a borrowed stream.

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
