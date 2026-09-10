# Metadata And Custom Data

Set standard metadata in the constructor or with `info`, and add custom Info
dictionary values with `info({ ReportId: "Q1-2026" })` or
`custom("ReportId", "Q1-2026")`. Both custom-entry spellings match Wasm; the last
call for a given custom key wins. Custom keys belong in method calls, not
constructor options.

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
debugging view of an opened source PDF. See [`tests/recipe/info.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/info.js) and
[`tests/recipe/modify.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/modify.js).

To add metadata to a document that already exists, including dotted OID keys,
see [Add Metadata to an Existing PDF](../how-to/add-metadata-to-existing-pdfs.md).
