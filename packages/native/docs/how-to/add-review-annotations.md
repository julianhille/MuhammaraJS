# Add Review Annotations

Use Recipe annotations to add comments, FreeText boxes, or highlights to a new
or existing page. Use numeric coordinates for placement.

```javascript
var pdfDoc = new Recipe("input.pdf", "output.pdf");

pdfDoc
  .editPage(1)
  .comment("Please review this section.", 300, 100, {
    title: "Review",
    replies: [{ text: "Confirmed.", title: "Reviewer" }],
  })
  .annot(100, 200, "Highlight", {
    width: 200,
    height: 14,
    color: "#ffff00",
    opacity: 0.45,
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
Both `comment()` and `annot()` accept `replies`, an array of objects with `text`
and optional `title`, `date`, `subject`, `richText`, `flag`, and `opacity`. Each
reply is a separate annotation linked to its parent through `/IRT` and `/RT /R`.
Text options `highlight`, `underline`, `strikeOut`, and `squiggly` also create
markup annotations. Their nested object sets `text`, `color`, `opacity`, and
`replies`; put shared metadata such as `title`, `date`, and `subject` on the
outer text options.

Set `richText: true` on a comment to use supported HTML formatting.

`title`, `subject`, and contents are written as PDF text strings, so non-ASCII
characters display correctly in PDF viewers. `0` and `false` are preserved as
`"0"`/`"false"` rather than becoming an empty title or subject.

To change or remove an annotation that is already in a document, see
[Edit or Remove an Existing Annotation](edit-existing-annotations.md).
