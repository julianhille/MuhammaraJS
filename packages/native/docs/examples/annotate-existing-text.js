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

module.exports = annotateExistingText;
