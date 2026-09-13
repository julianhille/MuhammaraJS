# Recipe API Invariants

- Recipe uses a top-left coordinate origin; low-level PDF APIs use bottom-left.
- Recipe page numbers are one-based, including `editPage`, `pageInfo`, and
  document composition methods.
- Call `endPage()` before selecting, creating, or editing another page.
- Call `endPDF()` only after all page and document operations are complete.
- `pauseContext()` and `resumeContext()` are chainable for valid transitions.
  They throw when there is no matching active or paused page content context.
- Buffer output is delivered to the `endPDF` callback; `endPDF()` does not return
  the PDF Buffer.
- `editPage` requires an existing input PDF and an output target unless using the
  tested Buffer workflow.
- `deletePage` accepts one-based original source page numbers. At least one page
  must remain, and deletion cannot be mixed with page insertion or addition in
  the same Recipe. If deletion fails during `endPDF()`, the Recipe releases its
  resources and remains ended; create a new Recipe to retry.
- Text, image, and annotation placement uses Recipe coordinates, including on
  rotated source pages.
- `table` and `layout` are implemented and tested, but their declarations are
  incomplete; use them with the documented tested call patterns.
- Fixed-height text clipping requires `textBox.height` and
  `textBox.clipIfExceedsBox: true`. `textBox.onClip` is invoked only when text
  is actually clipped; configuring it without clipping emits a warning.

The Recipe tests under `tests/recipe/` verify these constraints.
