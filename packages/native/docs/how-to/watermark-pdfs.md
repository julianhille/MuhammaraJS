# Watermark Every Page

Read the page count from Recipe metadata, edit each one-based page, and add
semi-transparent centered text.

```javascript
var pdfDoc = new Recipe("input.pdf", "watermarked.pdf");

for (var page = 1; page <= pdfDoc.metadata.pages; page++) {
  pdfDoc
    .editPage(page)
    .text("WATERMARK", "center", "center", {
      bold: true,
      size: 60,
      color: "#0000FF",
      align: "center center",
      opacity: 0.3,
    })
    .endPage();
}

pdfDoc.endPDF();
```

See [`tests/recipe/text.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/text.js) for the verified workflow.
