# Recipe API Invariants

- Recipe uses a top-left coordinate origin; low-level PDF APIs use bottom-left.
- Recipe page numbers are one-based, including `editPage`, `pageInfo`, and
  document composition methods.
- Call `endPage()` before selecting, creating, or editing another page.
- Call `endPDF()` only after all page and document operations are complete.
- Buffer output is delivered to the `endPDF` callback; `endPDF()` does not return
  the PDF Buffer.
- `editPage` requires an existing input PDF and an output target unless using the
  tested Buffer workflow.
- Text, image, and annotation placement uses Recipe coordinates, including on
  rotated source pages.
- `table` and `layout` are implemented and tested, but their declarations are
  incomplete; use them with the documented tested call patterns.
- Fixed-height text clipping requires `textBox.height` and
  `textBox.clipIfExceedsBox: true`. `textBox.onClip` is invoked only when text
  is actually clipped; configuring it without clipping emits a warning.

The Recipe tests under `tests/recipe/` verify these constraints.
