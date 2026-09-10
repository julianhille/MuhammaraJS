# Set Page Boxes

Set page boxes before writing the page to define the PDF media, crop, bleed,
trim, or art area. Every box is `[left, bottom, right, top]` in low-level PDF
coordinates.

Recipe uses the same box names and PDF bottom-left coordinates for this method,
even though its drawing methods use top-left coordinates. Set boxes after
`createPage()` and before `endPage()`:

```javascript
var Recipe = require("@muhammara/native").Recipe;
var pdfDoc = new Recipe("new", "page-boxes.pdf");

pdfDoc
  .createPage(595, 842)
  .setPageBox("media", 0, 0, 595, 842)
  .setPageBox("crop", 18, 18, 577, 824)
  .setPageBox("bleed", 0, 0, 595, 842)
  .setPageBox("trim", 18, 18, 577, 824)
  .setPageBox("art", 36, 36, 559, 806)
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
