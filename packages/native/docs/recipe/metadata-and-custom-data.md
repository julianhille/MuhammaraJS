# Metadata And Custom Data

Set standard metadata in the constructor or with `info`, and add custom Info
dictionary values with `custom`.

```javascript
var pdfDoc = new Recipe("new", "output.pdf", {
  author: "Example Co.",
  title: "Quarterly Report",
  subject: "Q1",
  keywords: ["q1", "report"],
});

pdfDoc.custom("ReportId", "Q1-2026").createPage().endPage().endPDF();
```

For an existing document, `info()` without arguments reads current metadata;
`info(options)` queues updates for finalization. `structure(path)` writes a
debugging view of an opened source PDF. See `tests/recipe/info.js` and
`tests/recipe/modify.js`.
