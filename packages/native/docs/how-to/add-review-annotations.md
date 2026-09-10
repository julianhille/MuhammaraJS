# Add Review Annotations

Use Recipe annotations to add comments, FreeText boxes, or highlights to a new
or existing page. Numeric coordinates are the typed interface; `center` is also
used by the current Recipe tests for placement.

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
  .endPage()
  .endPDF();
```

Set `opacity` from `0` (transparent) to `1` (opaque, the default). Recipe writes
the annotation's `/CA` value; the `color` option sets its RGB color separately.
Both `comment()` and `annot()` accept `replies`, an array of objects with `text`
and optional `title`, `date`, `subject`, `richText`, and `flag`. Each reply is a
separate annotation linked to its parent through `/IRT` and `/RT /R`.
The dictionary behavior is covered by
[`tests/recipe/annotation-parity.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/annotation-parity.js).

Set `richText: true` on a comment to use supported HTML formatting. See
[`tests/recipe/annotation-comment.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/annotation-comment.js) and [`tests/recipe/annotation-text.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/annotation-text.js).

To change or remove an annotation that is already in a document, see
[Edit or Remove an Existing Annotation](edit-existing-annotations.md).
