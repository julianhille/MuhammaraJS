# Native addon fuzzer

A mutation fuzzer for the C++ addon. It takes the files in `tests/TestMaterials`
as seeds, mutates them, and feeds them through the public API:

| Target                          | What it drives                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `pdf-read`                      | `createReader`, the object graph, stream decoding, page boxes and text extraction |
| `pdf-modify`                    | `createWriterToModify`, `PDFPageModifier` and copying from the modified file      |
| `pdf-copy`                      | `appendPDFPagesFromPDF`, form XObjects from pages and page merging                |
| `pdf-recrypt`                   | `recrypt`                                                                         |
| `jpeg`, `png`, `tiff`           | image info, the image XObject creators and `drawImage`                            |
| `truetype`, `opentype`, `type1` | font loading, text measurement, writing and subsetting                            |

A JS exception is a clean rejection. These are findings:

- **crash**: a signal or an AddressSanitizer/UBSan report.
- **leak**: with `--leaks`, memory that LeakSanitizer finds unreachable.
  Workers run batches of `--batch` cases (default 50) with leak checks on, and
  a leaking batch is replayed one case at a time to find the inputs that leak.
- **timeout**: a case that runs longer than `--timeout` (default 20000 ms).
- **slow**: a case that finishes, but takes longer than `--slow` (default
  5000 ms).
- **memory**: a worker whose RSS grows past `--rss` MB (default 2048). A
  single allocation over that size, or RSS over twice it, is an ASan crash.

Crashes, leaks and timeouts with the same top stack frames are reported once.

## Running

Build with sanitizers first, as the `sanitizer` job in
`.github/workflows/ci-native.yml` does:

```sh
CFLAGS="-fsanitize=address,undefined -fno-omit-frame-pointer -g -O1" \
CXXFLAGS="-fsanitize=address,undefined -fno-omit-frame-pointer -g -O1" \
LDFLAGS="-fsanitize=address,undefined" \
npm exec --workspace=@muhammara/native-with-source -- node-pre-gyp rebuild
```

Then, from `packages/native-with-source`:

```sh
export LD_PRELOAD="$(gcc -print-file-name=libasan.so)"
export ASAN_OPTIONS=halt_on_error=1
export UBSAN_OPTIONS=halt_on_error=1:print_stacktrace=1:suppressions=$PWD/../../.github/sanitizer/ubsan.supp
node fuzz/fuzz.js --iterations 100000 --jobs 4 --leaks
```

Add `--leaks` to look for leaks too. Other options: `--target pdf-read,png`
limits the targets, `--seed n` fixes the mutation sequence (a run is not fully repeatable: seeds written at startup and wall-clock budgets vary, so keep the saved input of a finding), and `--out dir` moves
the output (default `fuzz/out`).

Each finding is saved to `<out>/crashes` as `<kind>-*.bin`,
with the target name in `.bin.target` and the sanitizer report in `.log`.
Replay one with:

```sh
node fuzz/fuzz.js --replay fuzz/out/crashes/crash-....bin
```

Add a regression test for each fix to the specification test that covers the
affected behavior, such as `tests/BasicPNGImagesTest.js` for a PNG fix, and to
the Wasm test of the same name in `packages/wasm/tests/integration/`: the fixed
code is shared with the Wasm build. Build malformed inputs from the shared
fixtures with `tests/helpers/malformedInputs.js`
(`packages/wasm/tests/malformedInputs.mjs` on the Wasm side). Keep a finding's
saved input in `tests/TestMaterials/fuzz/` only when it reproduces from that
file alone; the Wasm security suite
(`packages/wasm/tests/security/FuzzRegressions.test.mjs`) replays every file
there.
