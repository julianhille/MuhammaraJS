# Replace A PDF's Text Layer

Scanned PDFs often carry an old or poor OCR text layer. To add your own, first
remove the existing text from every page, then write the new words at the
positions your OCR engine reports.

```javascript
var Recipe = require("@muhammara/native").Recipe;

function replaceTextLayer(inputPath, outputPath, words) {
  var recipe = new Recipe(inputPath, outputPath);
  var pages = recipe.read().pages;

  for (var pageNumber = 1; pageNumber <= pages; pageNumber++) {
    recipe.removeText(pageNumber, { forms: true });
  }

  words.forEach(function (word) {
    recipe
      .editPage(word.page)
      .text(word.text, word.x, word.y, { size: word.size, opacity: 0 })
      .endPage();
  });
  recipe.endPDF();
}
```

`removeText()` drops the text-showing operators (`Tj`, `TJ`, `'`, `"`) and
keeps everything else: the scanned image, vector graphics, and marked content.
`{ forms: true }` also cleans the Form XObjects each page paints. OCR tools
often put their text layer in one, and Recipe's own `editPage()` text lives
there too. Leave it off when a form holds content that should keep its text,
such as a letterhead shared with other pages.

Opacity `0` keeps the new words invisible but still searchable and selectable.
Because text added with `editPage()` in the same Recipe is never removed, the
order of the two steps does not matter.

Limits:

- Annotation appearances, such as filled-in form fields, keep their text.
- Content streams and forms are rewritten in place, so one shared with another
  page loses its text there too.
- The result is an incremental update. The old text bytes can remain in the
  file, so this is not redaction.
