# Modify And Inspect PDFs

Open an input PDF with an output path, select a one-based page number, add
content, and finalize the page before ending the document.

```javascript
var Recipe = require("muhammara").Recipe;
var pdfDoc = new Recipe("input.pdf", "output.pdf");

pdfDoc
  .editPage(1)
  .text("Added text", 150, 300)
  .rectangle(20, 20, 40, 100)
  .endPage()
  .endPDF();
```

Use `pageInfo(pageNumber)` to inspect a page. To write a textual PDF structure,
call `structure` on the Recipe instance:

```javascript
pdfDoc.structure("pdf-structure.txt").endPDF();
```

See `tests/recipe/modify.js` and `tests/recipe/info.js` for verified examples.
