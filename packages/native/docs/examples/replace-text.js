var muhammara = require("@muhammara/native");

/**
 * Reads the decoded text of each text-showing operation on a page.
 *
 * @param {string} path PDF path.
 * @param {number} pageIndex Zero-based page index.
 * @returns {string[]} Decoded texts in drawing order.
 */
function pageTexts(path, pageIndex) {
  var reader = muhammara.createReader(path);

  try {
    return reader.extractPageText(pageIndex).map(function (element) {
      return element.text;
    });
  } finally {
    reader.end();
  }
}

/**
 * Replaces `text` with `replacement` on one page, keeping its position and
 * font.
 *
 * @param {string} input Source PDF path.
 * @param {string} output Output PDF path.
 * @param {number} pageNumber One-based page number.
 * @param {string} text Text to replace.
 * @param {string} replacement Replacement text.
 * @returns {number} The number of text operations that changed.
 * @throws {Error} If the font has no glyph for a character of `replacement`.
 */
function replacePageText(input, output, pageNumber, text, replacement) {
  new muhammara.Recipe(input, output)
    .replaceText(text, replacement, pageNumber)
    .endPDF();

  var pageIndex = pageNumber - 1; // Reader pages are zero-based.
  var after = pageTexts(output, pageIndex);
  return pageTexts(input, pageIndex).filter(function (before, index) {
    return before === text && after[index] === replacement;
  }).length;
}

module.exports = replacePageText;
