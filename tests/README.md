# Tests

The Recipe is one implementation, in `packages/shared`, so its tests are
written once and run on both ends.

| Folder           | Runs on     | Holds                                                                                   |
| ---------------- | ----------- | --------------------------------------------------------------------------------------- |
| `recipe/`        | both ends   | every Recipe behaviour: the same input must give the same outcome on native and Wasm    |
| `native/recipe/` | native only | what is meant to differ: paths, output files, streams, Buffer sources, `fontSrcPath`    |
| `wasm/recipe/`   | Wasm only   | what is meant to differ: bytes, Blob/File, registered assets, `dispose()`, clear throws |
| `support/`       | —           | `ends.mjs` (the two ends and their I/O) and helpers that read the produced PDFs         |

Fixtures stay in `packages/native-with-source/tests/TestMaterials`; use
`fixture(name)`, `end.image(name)` and `end.pdf(name)` to reach them.

```sh
npm run test:shared                        # both ends
MUHAMMARA_END=native npm run test:shared   # one end
```

`npm run test:shared` builds first. A direct `npx mocha tests/recipe/x.test.mjs`
runs the last build, so run `npm run build:js` first; it takes under a second.

A spec asserts on the produced PDF (`drawnContent`, `textRuns`,
`annotations`, `info`), on return values and on thrown errors, never on how
an end draws internally (inline paths or form XObjects, operator order).

Tests import the shipped packages. Unit tests of a shared helper that no
package exposes may import `@muhammara/shared` with a plain `describe`, which
runs once whatever end is selected. Pin the same behaviour through the Recipe
with `describeEnds`.
