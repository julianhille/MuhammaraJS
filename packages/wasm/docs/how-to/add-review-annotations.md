# Add Review Annotations

Use Recipe annotations to add comments, markup, and review regions to a new or
existing byte-backed page. Recipe page numbers are one-based and drawing
coordinates use a top-left origin.

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var pdf = new Recipe(inputBytes);

var outputBytes = pdf
  .editPage(1)
  .comment("Please review this section.", 300, 100, {
    title: "Review",
    richText: true,
    replies: [{ text: "Confirmed." }],
  })
  .annot(100, 200, "Highlight", {
    width: 200,
    height: 14,
    color: "#ffff00",
    opacity: 0.45,
  })
  .annot(90, 180, "Square", {
    width: 230,
    height: 60,
    color: "#ff0000",
    borderWidth: 2,
  })
  .text("Reviewed", 100, 250, {
    title: "Review",
    underline: { text: "Approved", color: "#00aa00", opacity: 0.8 },
    strikeOut: { text: "Superseded", color: "#ff0000" },
  })
  .endPage()
  .endPDF();
```

Set `opacity` from `0` (transparent) to `1` (opaque, the default). Recipe writes
the annotation's `/CA` value; the `color` option sets its RGB color separately.
On new pages, both `comment()` and `annot()` accept `replies`, an array of objects
with `text` and optional `title`, `date`, `subject`, `richText`, and `flag`. Each
reply is a separate annotation linked to its parent through `/IRT` and `/RT /R`.
A reply without its own `title`, `subject`, `date`, `flag`, `open`, or icon
inherits the parent's, matching native. A reply keeps its own contents,
`richText` mode, and `opacity` (opaque by default) regardless of the parent's.

Annotations are queued until `endPage()`. Supported markup subtypes include
`Highlight`, `Underline`, `StrikeOut`, and `Squiggly`. Recipe's rich-text form
is a Worker-safe XML subset, not arbitrary browser HTML.

Text options `highlight`, `underline`, `strikeOut`, and `squiggly` also create
markup annotations, one per drawn line, on new and edited pages. Their nested
object sets `text`, `color`, `opacity`, and `replies`; put shared metadata such
as `title`, `date`, and `subject` on the outer text options. `underline` and
`strikeOut` also draw the visible line. HTML `<u>` and `<s>` only draw the line
and add no annotation.

These options preserve metadata, rich text, and reply relationships on new
documents, edited pages, and pages created while modifying an existing document.
`date` accepts a string or `Date`. A paused edited page still flushes its queued
annotations and links when `endPage()` is called.
Pausing and resuming an edit preserves the content drawn in every context.

Editing a source page can add annotations. Appending or rebuilding a source page
does not deep-copy its existing `/Annots` graph.

To change or remove an annotation that is already in a document, see
[Edit or Remove an Existing Annotation](edit-existing-annotations.md).
