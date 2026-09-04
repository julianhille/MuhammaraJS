# Copying And Modification

`createWriterToModify` opens a PDF for incremental modification, either from a
file path or compatible input/output streams. Use `PDFPageModifier` to add
content to an existing page.

`appendPDFPagesFromPDF`, `mergePDFPagesToPage`, and `createFormXObjectsFromPDF`
provide writer-level document composition. `createPDFCopyingContext` creates a
`DocumentCopyingContext` for page-level append/merge, form creation, source
reader access, and advanced object copying.

Advanced copying methods include `copyObject`, `copyDirectObjectWithDeepCopy`,
`copyNewObjectsForDirectObject`, and `replaceSourceObjects`.

Page append and source-page indexes in the low-level copying API are zero-based.
Always finish a copying context with `end()` after its final operation. Form
creation from a source page returns an object ID, not a placeable form object.

```javascript
var writer = muhammara.createWriter("combined.pdf");
writer.appendPDFPagesFromPDF("source.pdf");
writer.end();
```

[`tests/AppendPagesTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/AppendPagesTest.js), [`tests/MergePDFPages.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/MergePDFPages.js),
[`tests/PDFCopyingContextTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/PDFCopyingContextTest.js), and [`tests/BasicModificationWithStreams.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/BasicModificationWithStreams.js)
cover these operations.

See [Copy And Embed PDFs](../low-level/copy-and-embed-pdfs.md) and
[Modify Existing PDFs](../low-level/modify-pdfs.md) for workflows.
