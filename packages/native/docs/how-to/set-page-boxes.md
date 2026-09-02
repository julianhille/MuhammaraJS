# Set Page Boxes

Set page boxes before writing the page to define the PDF media, crop, bleed,
trim, or art area. Every box is `[left, bottom, right, top]` in low-level PDF
coordinates.

```javascript
var page = pdfWriter.createPage();

page.mediaBox = [0, 0, 595, 842];
page.cropBox = [18, 18, 577, 824];
page.bleedBox = [0, 0, 595, 842];
page.trimBox = [18, 18, 577, 824];

pdfWriter.writePage(page);
```

`artBox` is available for an application-defined content region. Unset optional
boxes are `undefined`. This workflow covers newly created pages; resizing an
existing page and preserving its annotations require separate verification.
See [`tests/PageBoxes.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/PageBoxes.js).
