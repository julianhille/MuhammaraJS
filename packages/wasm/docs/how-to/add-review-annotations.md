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
On new and edited pages, both `comment()` and `annot()` accept `replies`, an array of objects
with `text` and optional `title`, `date`, `subject`, `richText`, and `flag`. Each
reply is a separate annotation linked to its parent through `/IRT` and `/RT /R`.
A reply without its own `title`, `subject`, `date`, `flag`, `open`, or icon
inherits the parent's, matching native. A reply keeps its own contents,
`richText` mode, and `opacity` (opaque by default) regardless of the parent's.

Replies inherit the parent's title, subject, date, flags, open state, and icon.
Set a reply's own title, subject, date, or flag to override that metadata.
Each reply's opacity defaults to `1`, and rich text remains opt-in per reply.

Set `flag` to a `Recipe.AnnotFlag` value, such as `Recipe.AnnotFlag.PRINT`,
or to a numeric bit mask such as `4`; flag names match case-insensitively. An
unknown flag name throws `Error: Unknown annotation flag (<name>)` when
`annot()` or `comment()` is called. Subtypes are `Recipe.AnnotSubtype` values,
matched case-insensitively and written with their PDF casing.

Annotations are queued until `endPage()`. Supported markup subtypes include
`Highlight`, `Underline`, `StrikeOut`, and `Squiggly`. Text options
`highlight`, `underline`, `strikeOut`, and `squiggly` also create markup
annotations. Their nested object sets `text`, `color`, `opacity`, and
`replies`; put shared metadata such as `title`, `date`, and `subject` on the
outer text options. In `html: true` text, `<u>` and `<del>` (and Wasm's `<s>`
and `<strike>`) draw lines in the text color instead of annotations.
Recipe's rich-text form is a Worker-safe XML subset, not arbitrary browser
HTML.

For a dashed review region, set `border: { width: 2, dash: [3, 4] }`. The dash
pattern works on new and edited pages. `annot()`, `comment()`, and the text
markup options check annotation geometry and appearance when they are called;
invalid values throw `TypeError: Invalid annotation options` and add nothing,
so the page can still end normally.
Contents, titles, subjects, and icon names are written as PDF text strings, so
non-ASCII characters display correctly in PDF viewers, as on native. Titles
and subjects preserve `0` and `false`; nullish metadata and falsy contents are
empty. `text()` validates all its markup options before drawing, including
when several markup types are requested together.

Text options `highlight`, `underline`, `strikeOut`, and `squiggly` also create
markup annotations, one per drawn line, on new and edited pages. Their nested
object sets `text`, `color`, `opacity`, and `replies`; put shared metadata such
as `title`, `date`, and `subject` on the outer text options. `underline` and
`strikeOut` also draw the visible line. HTML `<u>` and `<s>` only draw the line
and add no annotation.

With `textBox.wrap: "clip"`, text-markup rectangles and quadrilaterals are
limited to the line's visible clipping region. Hidden portions of the text do
not create markup outside that region.

These options preserve metadata, rich text, and reply relationships on new
documents, edited pages, and pages created while modifying an existing document.
`date` accepts a string or `Date`. A paused edited page still flushes its queued
annotations and links when `endPage()` is called.
Pausing and resuming an edit preserves the content drawn in every context.

Editing a source page can add annotations. Appending or rebuilding a source page
does not deep-copy its existing `/Annots` graph.

To change or remove an annotation that is already in a document, see
[Edit or Remove an Existing Annotation](edit-existing-annotations.md).
