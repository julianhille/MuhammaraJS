# Test matrices

Test matrices check that native and Wasm behave the same. Each one runs a
shared set of cases on both ends and compares the output against a single
snapshot. Behaviour that is specific to one end, or meant to differ, belongs
in that package's own tests.

## Layout

Each matrix gets its own folder, for example `direction-matrix/`:

- `cases.cjs`: the cases. Each case has a name and what to draw, plus the
  properties it must have.
- `matrix.cjs`: reduces a drawing to what both ends must agree on, checks the
  properties, and reads and writes the snapshot. It also lists the known
  differences.
- `expected.json`: the snapshot. It holds every case's output from both ends,
  under `native` and `wasm`. The file is generated, so don't edit it by hand.
  It is listed in `.prettierignore`.

Each package has a thin runner that draws the cases with its own API and
hands the result to `matrix.cjs`:

- native: `packages/native-with-source/tests/recipe/<name>.js`
- Wasm: `packages/wasm/tests/recipe/<name>.test.mjs`

These runners run as part of each package's normal `npm test`. Both CI
workflows also run when `test-matrices/**` changes.

## What a case checks

1. **Properties**: things that must hold whatever the snapshot says, such as
   right-aligned text ending at the right edge.
2. **Snapshot**: the end's output must equal its own entry in `expected.json`.
3. **Parity**: the native and Wasm entries must be equal, unless the case
   matches a known difference.

## Known differences

Sometimes the ends differ for a reason the matrix doesn't test, for example an
older difference in HTML parsing. Add a pattern for the affected case names to
`KNOWN_DIFFERENCES` in `matrix.cjs`, with the reason. The case still checks
its properties, and each end must keep matching its own snapshot. Remove the
entry once the difference is fixed.

## Updating the snapshot

When output changes on purpose, rewrite each end's entries and review the
diff of `expected.json`:

```sh
UPDATE_DIRECTION_MATRIX=1 npm test --workspace=@muhammara/native-with-source
UPDATE_DIRECTION_MATRIX=1 npm test --workspace=@muhammara/wasm
```

Each end writes only its own entries.

## Adding a matrix

Create a new folder with the files above, and add a runner to each package.
`direction-matrix/matrix.cjs` is a good starting point. When a second matrix
needs the snapshot plumbing (reading and writing `expected.json`, the update
flag, and known differences), move that plumbing into a shared helper here.
