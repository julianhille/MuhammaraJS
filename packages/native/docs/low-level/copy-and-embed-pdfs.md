# Copy And Embed PDFs

Use `appendPDFPagesFromPDF` to append source pages to the output document. Use
`mergePDFPagesToPage` when source page content must be placed on an existing
target page.

An `appendPDFPagesFromPDF` failure while copying pages ends the writer because
the failed copy can leave partial output; create a fresh writer and retry with a
valid source. A source that cannot be opened, parsed, or decrypted, and page
ranges outside the source, are rejected before anything is written, so the
writer stays usable.

For more control, create a copying context:

```javascript
var copyingContext = pdfWriter.createPDFCopyingContext("source.pdf");
copyingContext.appendPDFPageFromPDF(0);
copyingContext.end();
```

Copying contexts can append individual pages, merge a source page into a page
or form XObject, and expose a source reader. Form-creation APIs return object
IDs that can be mapped for placement; do not assume they return form objects.
Calls on a copying context after `end()` throw instead of accessing its released
source parser.
