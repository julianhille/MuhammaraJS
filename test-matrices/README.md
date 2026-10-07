# Test matrices

A test matrix runs the same cases on native and Wasm and checks both against
one set of expected output, so the two ends keep behaving alike. Behaviour
that belongs to one end only, or is meant to differ, is tested in that
package's own tests.

## Layout

Each matrix has its own folder, such as `direction-matrix/`:

- `cases/<kind>/<scenario>.yml`: one scenario per file, named after what it
  draws. A file holds the scenario's input and the expected output of every
  variation it is drawn in, for both ends.
- `matrix.cjs`: loads the files, turns them into cases, reduces a drawing to
  what both ends must agree on, checks the properties, and writes the
  expected output back.

Each package has a thin runner that draws every case with its own API and
hands the result to `matrix.cjs`:

- native: `packages/native-with-source/tests/recipe/<name>.js`
- Wasm: `packages/wasm/tests/recipe/<name>.test.mjs`

The runners are part of each package's `npm test`, and both CI workflows run
when `test-matrices/**` changes.

## A scenario file

```yaml
description: Two Hebrew words with points
kind: single
text: "ש\u05c1\u05b8לו\u05b9ם עו\u05b9ל\u05b8ם"
expected:
  rtl cs3 right:
    native:
      lines:
        - [["ם\u05b8ל\u05b9וע ם\u05b9ול\u05b8\u05c1ש", 277.24]]
      annotations: []
    wasm: same
```

- `description` names the scenario. Each test title is the description
  followed by the variation, for example
  `Two Hebrew words with points: rtl, char space 3, right aligned`.
- `kind` picks how the scenario is drawn, which variations it is drawn in,
  and which properties those must keep. The kinds are defined in
  `matrix.cjs`. In `direction-matrix` they are:
  - `single`: one `text()` call. It takes `text` and is drawn in every
    direction, character spacing and alignment.
  - `break`: a `break` character ending a plain text, and ending a flow's run
    with something after it.
  - `flow`: a flow of `runs`, each with its `text` and its own options, drawn
    with different endings, directions and alignments.
- `expected` holds each variation's output: the runs of each line from top to
  bottom, as `[text, x]`, and each annotation's `[left, right]`. `wasm: same`
  means Wasm draws exactly what native draws.

Strings are double-quoted. Points, other marks, formatting characters and
spaces other than U+0020 are written as `\uXXXX`, so a review shows them.

## What a case checks

1. **Properties** that must hold whatever the expected output says, for
   example that right-aligned text ends at the right edge.
2. **Its own end:** the output must equal that end's expected output.
3. **Parity:** the native and Wasm output must be equal, unless the
   variation has a known difference.

## Known differences

When the ends differ for a reason outside what the matrix tests, such as an
older difference in HTML parsing, give the variation a reason:

```yaml
end none left:
  native: …
  wasm: …
  knownDifference: "Wasm's HTML parser ends a tag at a '>' inside a quoted attribute"
```

Its properties are still checked, and each end must keep matching its own
output. Once the ends draw it alike, the case fails until the reason is
removed.

## Updating the expected output

When output changes on purpose, write each end's output into the files and
review the diff:

```sh
UPDATE_DIRECTION_MATRIX=1 npm test --workspace=@muhammara/native-with-source
UPDATE_DIRECTION_MATRIX=1 npm test --workspace=@muhammara/wasm
```

Each end writes only its own output, and the input above `expected:` stays as
written. To add a scenario, add a file with its input and an empty
`expected: {}`, then run both updates.

## Adding a matrix

Create a folder with a `cases/` folder and a `matrix.cjs`, and add a runner
to each package; `direction-matrix/matrix.cjs` is the starting point. Once a
second matrix needs the same loading and writing of expected output, move
that part into a shared helper here.
