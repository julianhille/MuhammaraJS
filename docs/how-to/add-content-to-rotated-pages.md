# Add Content To Rotated Pages

Recipe normalizes its top-left coordinate system when editing portrait or
landscape pages rotated by 0, 90, 180, or 270 degrees. Read the page dimensions
before placing size-dependent content.

```javascript
var pdfDoc = new Recipe("rotated-input.pdf", "output.pdf");
var page = pdfDoc.pageInfo(1);

pdfDoc
  .editPage(1)
  .text("[0,0] is here", 0, 0, { fontSize: 36, bold: true })
  .rectangle(0, 0, page.width / 2, page.height / 2, { opacity: 0.2 })
  .endPage()
  .endPDF();
```

See `tests/recipe/rotation.js` and `tests/recipe/annotation-coordinate.js` for
the tested rotation combinations.
