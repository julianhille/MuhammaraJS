var muhammara = require("@muhammara/native");

/**
 * Writes Hebrew with the low-level writer: lines from the left edge and one
 * ending at a right margin.
 *
 * @param {string} outputPath Output PDF path.
 * @param {string} fontPath A font with Hebrew glyphs.
 * @returns {void}
 */
function writeHebrew(outputPath, fontPath) {
  var writer = muhammara.createWriter(outputPath);
  var page = writer.createPage(0, 0, 595, 842);
  var font = writer.getFontForFile(fontPath);
  var context = writer.startPageContentContext(page);
  var options = {
    font: font,
    size: 14,
    direction: muhammara.TextDirection.AUTO,
  };

  context
    .writeText("שלום עולם", 72, 760, options)
    .writeText("מחיר 120 ש״ח", 72, 730, options);

  // x is the left edge of the drawn text, so subtract where its glyphs end
  // to end the line at the right margin. The text is measured as typed, so
  // the drawn text can end a fraction of a point from the margin; Recipe's
  // textAlign "right" measures it as drawn.
  var text = "שלום עולם";
  var width = font.calculateTextDimensions(text, 14).xMax;
  context.writeText(text, 523 - width, 700, options);

  writer.writePage(page);
  writer.end();
}

/**
 * Writes a wrapped, right-aligned Hebrew paragraph with Recipe and its
 * bundled Arial font.
 *
 * @param {string} outputPath Output PDF path.
 * @returns {void}
 */
function writeRecipeHebrew(outputPath) {
  new muhammara.Recipe("new", outputPath)
    .createPage(595, 842)
    .text("השועל החום המהיר קפץ מעל הכלב העצלן", 72, 72, {
      font: "Arial",
      size: 14,
      direction: muhammara.Recipe.TextDirection.AUTO,
      textBox: { width: 200, textAlign: "right" },
    })
    .endPage()
    .endPDF();
}

module.exports = {
  writeHebrew: writeHebrew,
  writeRecipeHebrew: writeRecipeHebrew,
};
