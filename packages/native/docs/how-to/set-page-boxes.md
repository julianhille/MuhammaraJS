# Set Page Boxes

Set page boxes before writing the page to define the PDF media, crop, bleed,
trim, or art area. Every box is `[left, bottom, right, top]` in low-level PDF
coordinates.

Recipe uses the `ePDFPageBox*` constants and PDF bottom-left coordinates for this method,
even though its drawing methods use top-left coordinates. Set boxes after
`createPage()` and before `endPage()`:

```javascript
var muhammara = require("@muhammara/native");
var Recipe = muhammara.Recipe;
var pdfDoc = new Recipe("new", "page-boxes.pdf");

pdfDoc
  .createPage(595, 842)
  .setPageBox(muhammara.ePDFPageBoxMediaBox, 0, 0, 595, 842)
  .setPageBox(muhammara.ePDFPageBoxCropBox, 18, 18, 577, 824)
  .setPageBox(muhammara.ePDFPageBoxBleedBox, 0, 0, 595, 842)
  .setPageBox(muhammara.ePDFPageBoxTrimBox, 18, 18, 577, 824)
  .setPageBox(muhammara.ePDFPageBoxArtBox, 36, 36, 559, 806)
  .endPage()
  .endPDF();
```

```javascript
var page = pdfWriter.createPage();

page.mediaBox = [0, 0, 595, 842];
page.cropBox = [18, 18, 577, 824];
page.bleedBox = [0, 0, 595, 842];
page.trimBox = [18, 18, 577, 824];

pdfWriter.writePage(page);
```

`artBox` is available for an application-defined content region. Unset optional
boxes are `undefined`. These workflows cover newly created pages; resizing an
existing page and preserving its annotations require separate verification.
See [`tests/PageBoxes.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/PageBoxes.js).
