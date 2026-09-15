# Recipe API Invariants

- Recipe uses a top-left coordinate origin; low-level PDF APIs use bottom-left.
- `new Recipe(src, output, options)` reads a file path or `Buffer`. Omitting
  `output` writes back to a file-path `src`; a `Buffer` source without an output
  path returns bytes only through the `endPDF()` callback.
- Recipe page numbers are one-based, including `editPage`, `pageInfo`, and
  document composition methods.
- Call `endPage()` before selecting, creating, or editing another page.
- Call `endPDF()` only after all page and document operations are complete.
- `endPDF()` finalizes a Recipe only once. Later calls do not rewrite the PDF;
  when given a callback, they invoke it with the already completed output where
  applicable. Create a new Recipe to produce changed output.
- `pauseContext()` and `resumeContext()` are chainable for valid transitions.
  They throw when there is no matching active or paused page content context.
- Buffer output is delivered to the `endPDF` callback; `endPDF()` does not return
  the PDF Buffer.
- File-backed output is written directly to `output`, or to `src` when output is
  omitted. The write is not atomic: if `endPDF()` fails, the destination may be
  incomplete. Use a separate output path, make a temporary source copy, or use
  callback-only Buffer output when the original must be preserved. A failure
  retires the Recipe, releases its source reader, and is rethrown by later
  `endPDF()` calls; create a new Recipe to retry.
- `editPage` requires an existing input PDF and an output target unless using the
  tested Buffer workflow.
- `deletePage` accepts one-based original source page numbers. At least one page
  must remain, and deletion cannot be mixed with page insertion or addition in
  the same Recipe. Page-tree cycles, retained references to deleted pages, and
  nonzero-generation rewrites are validated during `endPDF()`, not
  `deletePage()`.
- `insertPage()` and `appendPage()` throw synchronously for invalid or missing
  arguments; neither silently no-ops.
- `read()` inspects a source without replacing the Recipe's output state.
- Text, image, and annotation placement uses Recipe coordinates, including on
  rotated source pages.
- `table` and `layout` are implemented, tested, and represented by the
  `Recipe.TableOptions` and `Recipe.LayoutOptions` TypeScript declarations.
- Fixed-height text clipping requires `textBox.height` and
  `textBox.clipIfExceedsBox: true`. `textBox.onClip` is invoked only when text
  is actually clipped; configuring it without clipping emits a warning.
