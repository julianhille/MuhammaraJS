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

## Watermark In Place

Omit the output path and Recipe writes back over the source file, so no second
document is produced:

```javascript
var pdfDoc = new Recipe("input.pdf");

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

The source is overwritten with no backup, and modification appends an
incremental update rather than rewriting the file, so a repeatedly watermarked
document keeps growing. Watermark once into a new file when you need to keep the
original or the smallest possible output.

See [`tests/recipe/modify-in-place.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/modify-in-place.js)
for the verified workflow.

## Watermark A Buffer

When the PDF is already in memory, pass the `Buffer` as the source and omit the
output path. `endPDF(callback)` then hands the finished document back as a
`Buffer` instead of writing a file:

```javascript
var pdfDoc = new Recipe(inputBuffer);

for (var page = 1; page <= pdfDoc.metadata.pages; page++) {
  pdfDoc
    .editPage(page)
    .text("WATERMARK", "center", "center", {
      size: 60,
      align: "center center",
      opacity: 0.3,
    })
    .endPage();
}

pdfDoc.endPDF(function (outputBuffer) {
  // outputBuffer holds the watermarked PDF.
});
```

Passing an output path alongside a `Buffer` source writes that file and gives
the path to the callback instead of the bytes. Page insertion and encryption are
not available in buffer mode.

See [`tests/recipe/createWithBuffer.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/createWithBuffer.js)
for the verified workflow.
