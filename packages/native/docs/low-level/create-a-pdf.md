# Create A PDF

Use `createWriter` to write a PDF to a file path or a custom output stream.
Create pages with a media box, write them, and finish the writer when all pages
have been added.

```javascript
var muhammara = require("@muhammara/native");
var pdfWriter = muhammara.createWriter("output.pdf");
var page = pdfWriter.createPage(0, 0, 595, 842);

pdfWriter.writePage(page);
pdfWriter.end();
```

The four `createPage` values are the left, bottom, right, and top coordinates
of the page media box, measured in PDF points (1/72 inch). Add page content
before calling `writePage`.

`createWriter` accepts an optional options object, including `version`,
`compress`, and `log`. Supported version values are `10` through `17` and `20`,
or the corresponding `ePDFVersion10` through `ePDFVersion17` and
`ePDFVersion20` constants. See [`tests/EmptyPagesPDF.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/EmptyPagesPDF.js) and
[`tests/PDFVersionTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/PDFVersionTest.js) for exercised writer and page-creation variants.
