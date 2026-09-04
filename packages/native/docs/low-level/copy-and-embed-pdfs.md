# Copy And Embed PDFs

Use `appendPDFPagesFromPDF` to append source pages to the output document. Use
`mergePDFPagesToPage` when source page content must be placed on an existing
target page.

For more control, create a copying context:

```javascript
var copyingContext = pdfWriter.createPDFCopyingContext("source.pdf");
copyingContext.appendPDFPageFromPDF(0);
copyingContext.end();
```

Copying contexts can append individual pages, merge a source page into a page
or form XObject, and expose a source reader. Form-creation APIs return object
IDs that can be mapped for placement; do not assume they return form objects.

See [`tests/AppendPagesTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/AppendPagesTest.js), [`tests/MergePDFPages.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/MergePDFPages.js),
[`tests/PDFEmbedTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/PDFEmbedTest.js), and [`tests/PDFCopyingContextTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/PDFCopyingContextTest.js) for tested
workflows.
