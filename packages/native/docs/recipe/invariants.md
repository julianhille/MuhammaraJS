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
- Text, image, and annotation placement uses Recipe coordinates, including on
  rotated source pages.
- `table` and `layout` are implemented, tested, and represented by the
  `Recipe.TableOptions` and `Recipe.LayoutOptions` TypeScript declarations.
- Fixed-height text clipping requires `textBox.height` and
  `textBox.clipIfExceedsBox: true`. `textBox.onClip` is invoked only when text
  is actually clipped; configuring it without clipping emits a warning.

The Recipe tests under `tests/recipe/` verify these constraints.
