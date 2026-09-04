# Compose PDFs

Recipe can append pages from another PDF, insert a selected page, overlay a PDF
on an edited page, or split a document into separate output files.

```javascript
var pdfDoc = new Recipe("input.pdf", "output.pdf");

pdfDoc
  .appendPage("appendix.pdf", 10)
  .appendPage("appendix.pdf", [4, 6])
  .appendPage("appendix.pdf", [
    [1, 3],
    [6, 20],
  ])
  .insertPage(2, "cover.pdf", 1)
  .endPDF();
```

Page numbers passed to Recipe composition methods are one-based. Omitting the
page selection from `appendPage` appends all pages.

To overlay another PDF, edit the target page first:

```javascript
pdfDoc.editPage(1).overlay("overlay.pdf").endPage().endPDF();
```

The overlay options support placement, scaling, page selection, aspect-ratio
preservation, and fit-to-width or fit-to-height behavior. To split a PDF, open
it without an output file and call `split(outputDirectory, prefix)` before
`endPDF()`.

See [`tests/recipe/appendPages.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/appendPages.js), [`tests/recipe/insertPage.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/insertPage.js),
[`tests/recipe/overlay.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/overlay.js), and [`tests/recipe/split.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/split.js) for tested workflows.
