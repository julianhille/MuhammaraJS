# Wasm Fuzzing

A mutation fuzzer for the WebAssembly package. It feeds mutated PDFs, fonts and
images through the public byte-first API and reports three kinds of problem:

- **Crashes**: Wasm traps and aborts, C++ exceptions escaping the module,
  stack overflows, and JavaScript errors in the glue code.
- **Memory leaks**: heap an input leaves allocated after every reader, writer,
  modifier and Recipe it created was ended or disposed.
- **Denial of service**: inputs that hang, take too long, or grow Wasm memory
  by too much.

Rejecting an input with an ordinary error is the expected outcome and is not
reported.

## Running

Build the package first. Which build you fuzz decides what can be found:

| Build                             | Crashes                                                                            | Leaks | Denial of service |
| --------------------------------- | ---------------------------------------------------------------------------------- | ----- | ----------------- |
| `MUHAMMARA_WASM_SANITIZE=address` | Also heap overflows, use-after-free and stack overflows, where they happen         | Yes   | Hangs only        |
| Release (`npm run wasm:build`)    | Traps outside linear memory; corruption inside it crashes a later input, if at all | No    | Yes               |

AddressSanitizer runs inputs 20 to 50 times slower and inflates memory use, so
the time and memory checks are off under it unless `--slow` or `--memory` is
given. Fuzz both builds:

```sh
MUHAMMARA_WASM_SANITIZE=address npm run wasm:build
npm run fuzz --workspace=@muhammara/wasm -- --time 600 --timeout 120000 --no-dos-seeds

npm run wasm:build
npm run fuzz --workspace=@muhammara/wasm -- --time 600
```

The AddressSanitizer build writes to `packages/wasm/dist` like any other
build; run `npm run wasm:build` again before testing or packing.

| Option               | Default      | Effect                                                                                                                                         |
| -------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `--targets list`     | all          | Comma-separated targets, see below.                                                                                                            |
| `--time seconds`     | `60`         | Stop after this long; `0` runs until interrupted.                                                                                              |
| `--iterations n`     | unlimited    | Stop after this many inputs instead.                                                                                                           |
| `--jobs n`           | CPUs - 1     | Parallel workers.                                                                                                                              |
| `--seed n`           | current time | Seed of the mutation PRNG. Parallel jobs share it, so a run is not repeatable; replay a finding from its saved input.                          |
| `--timeout ms`       | `20000`      | Time one input may take before it counts as a hang. Raise it under AddressSanitizer.                                                           |
| `--slow ms`          | `2000`       | Report inputs with one API call that takes longer, plus 200 ms per MB of input, confirmed in a fresh instance. Release builds only by default. |
| `--memory mb`        | `128`        | Report inputs that grow Wasm memory by more, plus 8 times the input size, confirmed in a fresh instance. Release builds only by default.       |
| `--no-leaks`         |              | Skip leak confirmation.                                                                                                                        |
| `--no-dos-seeds`     |              | Leave out the seeds shaped like denial-of-service patterns, which are slow under AddressSanitizer.                                             |
| `--repeat n`         | `4`          | Runs of a leak candidate in a fresh instance.                                                                                                  |
| `--recycle n`        | `250`        | Inputs before a worker starts a fresh instance.                                                                                                |
| `--out dir`          | `findings/`  | Where findings are written (ignored by git).                                                                                                   |
| `--report-only list` |              | Finding kinds that are written but do not fail the run, such as `slow,memory,growth`.                                                          |
| `--sequence paths…`  |              | Run the given files in order in one instance of the first selected target.                                                                     |
| `--replay paths…`    |              | Run the given files, or the `.bin` files in the given directories, once each in fresh instances.                                               |

The command exits non-zero when it found anything.

## How Leaks Are Found

Every target releases everything it creates, so on a correct library an input
leaves the heap as it found it. The AddressSanitizer build exports the
allocator's count of live bytes, and the worker reads it before and after each
input. An input that leaves bytes behind is run again `--repeat` times in a
fresh instance: the first run may fill caches, so only growth on every later
run counts. LeakSanitizer then reports the allocations that became
unreachable, with their stacks, minus those present before the runs. Growth
without unreachable allocations is reported as `growth`: memory still
referenced, such as a cache that never stops growing.

Each set of rejections a target produces is confirmed once, so a leaky error
path is not re-run for every input that takes it.

## How Denial Of Service Is Found

Each step a target takes (one `attempt()` around an API call) is timed, and
Wasm memory is measured around it; a step's cost excludes the steps nested in
it. An input whose slowest step exceeds `--slow`, or that grows Wasm memory by
more than `--memory`, is run again in a fresh instance and reported only if it
is over again. The finding names the step responsible and is keyed by it, so a
known slow call does not hide another; each key keeps its worst input. Memory
never shrinks, so a worker restarts once its instance passes 256 MB, which
keeps growth measurable. Run time and memory growth also feed the corpus,
steering mutation toward expensive inputs. An input that does not finish
within `--timeout` is reported as a `timeout`.

`startReadingObjectsFromStream()` has no budget by design: parsing a
decompression bomb with it takes time in proportion to the decoded size
(about 40 MB per second), so the `reader` target reports `slow` findings for
it on bomb-like inputs. The extractors built on it, `extractPageText()` and
`extractPageContentItems()`, stop after 64 MiB of decoded content.

## Targets

| Target    | Input | Exercises                                                                                                                    |
| --------- | ----- | ---------------------------------------------------------------------------------------------------------------------------- |
| `reader`  | PDF   | `createReader()`, every object, stream decoding and tokenizing, page boxes, text extraction.                                 |
| `text`    | PDF   | `extractPageText()` and `extractPageContentItems()` on every page: fonts, encodings and ToUnicode CMaps decoded in the glue. |
| `modify`  | PDF   | `createWriterToModify()` page edits and `createModifier()`.                                                                  |
| `copy`    | PDF   | Appending, merging and form XObjects from a source PDF, and a copying context.                                               |
| `recrypt` | PDF   | `recrypt()` with and without passwords and encryption.                                                                       |
| `recipe`  | PDF   | Recipe editing, `structure()`, `read()`, `appendPage()` and `overlay()`.                                                     |
| `font`    | font  | FreeType loading, text measuring, and embedding text.                                                                        |
| `image`   | image | JPEG, PNG and TIFF detection, dimensions, form XObjects and `drawImage()`.                                                   |

Seeds come from `packages/native-with-source/tests/TestMaterials`, plus small
synthetic PDFs in `seeds.mjs` that put each parser feature (filters,
predictors, object and xref streams, incremental updates, ToUnicode maps) into
a few hundred uncompressed bytes, and uncompressed and encrypted rewrites of
the PDF seeds. Mutations are byte-level (bit flips, interesting values,
deletion, duplication, splicing), PDF-aware (number and name replacement,
syntax tokens, deep nesting), and structure-aware: a Flate stream is
inflated, mutated and recompressed with its `/Length` fixed, and PNG image
data likewise. Most mutated PDFs then get a fresh xref table appended, and
mutated PNGs fresh chunk CRCs; without them almost every mutant is rejected
before the code under test runs (3% of byte-mutated PDFs still parse, about
half with the rebuilt xref).

There is no coverage instrumentation. Instead, an input is added to the corpus
when it makes the library reject something in a way not seen before, or
produces a different shape of result (object types, decoded stream sizes, page
and text counts).

## Findings

Each finding is written as `<target>-<kind>-<hash>.bin` with a `.json` record
of the message, Wasm stack, sanitizer output, the mutations applied, and
whether it reproduces in a fresh instance. Crashes are grouped by kind,
message, and innermost stack frames, and leaks by where the first leaked
object was allocated, so one bug is written once. Kinds: `wasm-trap`,
`wasm-abort`, `exit` (a sanitizer report), `escaped-exception`,
`stack-overflow`, `js-error`, `timeout`, `oom`, `leak`, `growth`, `slow` and
`memory`.

A finding that does not reproduce alone usually means an earlier input
corrupted the heap. The inputs its instance ran are saved next to it, in
`<id>.history/`; replay them in order under an AddressSanitizer build to catch
the input that did:

```sh
node packages/wasm/tests/fuzz/fuzz.mjs --sequence --targets reader packages/wasm/tests/fuzz/findings/<id>.history
```

Reproduce one with:

```sh
node packages/wasm/tests/fuzz/fuzz.mjs --replay packages/wasm/tests/fuzz/findings/<id>.bin
```

After fixing a finding, add a regression test to the specification test that
covers the affected behavior, on both ends: the test in `tests/integration/`
and the native test of the same name in
`packages/native-with-source/tests/`, since the fixed code is shared. Build
malformed inputs from the shared fixtures with `tests/malformedInputs.mjs`
(`tests/helpers/malformedInputs.js` natively).

When a finding reproduces only from its saved input, copy that input to
`packages/native-with-source/tests/TestMaterials/fuzz/`, with the other shared
fixtures, named after its target (`<target>-<description>.bin`).
`tests/security/FuzzRegressions.test.mjs` replays every file there as part of
`npm run wasm:test`, and the Wasm Fuzzing workflow replays them under
AddressSanitizer, which catches memory errors a release build reads past.
