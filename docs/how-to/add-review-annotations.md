# Add Review Annotations

Use Recipe annotations to add comments, FreeText boxes, or highlights to a new
or existing page. Numeric coordinates are the typed interface; `center` is also
used by the current Recipe tests for placement.

```javascript
var pdfDoc = new Recipe("input.pdf", "output.pdf");

pdfDoc
  .editPage(1)
  .comment("Please review this section.", 300, 100, { title: "Review" })
  .annot(100, 200, "Highlight", { width: 200, height: 14 })
  .endPage()
  .endPDF();
```

Set `richText: true` on a comment to use supported HTML formatting. See
`tests/recipe/annotation-comment.js` and `tests/recipe/annotation-text.js`.
