# Recipe API Invariants

- `new Recipe(src, output, options)` reads a file path or `Buffer`. Omitting
  `output` writes back to `src` for a file path, which is the common in-place
  edit pattern; `Buffer` sources need an explicit `output` path to also write
  a file, otherwise bytes are only available via `endPDF()`'s callback.
- Recipe page numbers are one-based, including `editPage()`, `pageInfo()`,
  `deletePage()`, and composition source pages. Only `insertPage()` uses zero
  to mean before the first output page.
- File-backed Recipe output is written directly to `output` (or `src`, when
  `output` is omitted). This preserves ordinary filesystem behavior for
  permissions and links, but the write is not atomic: if `endPDF()` fails, the
  destination may contain an incomplete PDF. Applications that must preserve
  the source should provide a separate output path, make their own temporary
  copy, or use a `Buffer` source without an output path and consume the bytes
  from `endPDF()`'s callback.
- `deletePage()` applies only to original pages in a file- or buffer-backed
  Recipe, must leave at least one page, and cannot be combined with creating,
  appending, or inserting pages. Its validation - acyclic page tree, no
  retained reference to a deleted page, no rewrite of a nonzero-generation
  object - runs during `endPDF()`, not `deletePage()` itself; a `try`/`catch`
  placed only around `deletePage()` calls will not observe these errors.
- If `endPDF()` fails - whether from `deletePage()` validation or any other
  finalization step - the Recipe releases its resources and remains ended;
  create a new Recipe to retry. `endPDF()` and `deletePage()` afterward
  rethrow the same error.
- `insertPage()` and `appendPage()` throw synchronously for invalid or
  missing arguments; neither silently no-ops.
- `read()` inspects a source without replacing the Recipe's own output state.

Review the [wasm package's differences and restrictions](../../../wasm/docs/differences.md)
for how the byte-first `@muhammara/wasm` Recipe departs from this one - notably,
it never writes a path or stream.
