# Text Highlight Descender Bounds

## Problem

Browser Recipe `text(..., { highlight: ... })` must create semantic PDF text
markup annotations whose bounds include descenders. Glyphs such as `g`, `j`,
`p`, `q`, and `y` can extend below a nominal font-size rectangle.

## Resolution

Implemented in the browser Recipe wrapper. Highlights now use native
`textDimensions()` bounds: `xMin`, `xMax`, `yMin`, and `yMax`, converted from
the PDF text baseline to Recipe's top-left coordinate system. The Wasm ABI
writes `/QuadPoints` and `/C` for text-markup annotations.

Coverage includes `gypqj descenders` at 30 points in
`wasm/tests/recipe/text.test.mjs`.

## Node Recipe Difference

Both Recipe implementations use semantic PDF text-markup annotations. Node's
text layout already measures a glyph sample containing `gjpqy` in
`lib/recipe/text.js`; retain the Node descender regression test to guard that
measurement path.

## Remaining Work

- Add a demo sample assertion or visual fixture showing the corrected bounds.

## Acceptance Criteria

- Highlight annotation bounds cover ascenders and descenders without clipping.
- Highlight placement remains correct for ordinary uppercase-only text.
- `npm run wasm:test` passes with the new descender coverage.
