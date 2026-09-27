# Annotate Existing Text

Add an Underline or StrikeOut annotation to text already present in an
unrotated PDF by extracting its text-showing operations, converting the PDF
bottom-left origin to Recipe's top-left coordinates, then editing the page.

This example marks every text operation that reads exactly `Draft`. Matching
uses the decoded `text`, so non-ASCII words work too. `width` must describe the
known visual bounds in the source template; use a separate region for each
different width.

```javascript
var muhammara = require("@muhammara/native");
var Recipe = muhammara.Recipe;

/**
 * Underlines every text-showing operation on an unrotated page whose decoded
 * text is `text`.
 *
 * @param {string} input Source PDF path.
 * @param {string} output Output PDF path.
 * @param {number} pageNumber One-based page number.
 * @param {string} text Text to mark.
 * @param {number} width Known visual width of that text in the template.
 * @returns {number} The number of marked text operations.
 */
function annotateExistingText(input, output, pageNumber, text, width) {
  var pageIndex = pageNumber - 1; // Reader pages are zero-based.
  var reader = muhammara.createReader(input);
  var matches;

  try {
    matches = reader.extractPageText(pageIndex).filter(function (element) {
      return element.text === text;
    });
  } finally {
    reader.end();
  }

  var pdf = new Recipe(input, output);
  var page = pdf.pageInfo(pageNumber);

  pdf.editPage(pageNumber);
  matches.forEach(function (match) {
    pdf.annot(
      match.textMatrix[4],
      page.height - match.textMatrix[5] - match.fontSize,
      Recipe.AnnotSubtype.UNDERLINE,
      {
        width: width,
        height: match.fontSize,
        color: "#008000",
        text: "Reviewed",
      },
    );
  });
  pdf.endPage().endPDF();
  return matches.length;
}

annotateExistingText("input.pdf", "reviewed.pdf", 1, "Draft", 28);
```

Use `Recipe.AnnotSubtype.STRIKE_OUT` instead to create strikeout annotations.
The reader's `textMatrix` uses PDF's bottom-left coordinates, while Recipe uses
a top-left origin; the `page.height - y - fontSize` conversion above applies to
unrotated pages only.

`extractPageText()` reports a text operation's decoded `text`, raw `content`,
origin, font resource, and font size. It does not calculate glyph bounds, so it
cannot accurately derive `width` for arbitrary PDFs. This pattern is appropriate
for a controlled template where the target text and its bounds are known. For
arbitrary documents, obtain glyph bounds from another layout or text-analysis
tool before creating the annotation. See [Find Text Positions In A
PDF](find-text-positions.md) for the extractor's complete limitations, and [Add
Review Annotations](add-review-annotations.md) for annotation options.
