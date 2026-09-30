var Recipe = require("@muhammara/native").Recipe;

/**
 * Places the second page of a PDF like an image: fitted to a 200-point-wide
 * box, with a light fill beneath it and a dashed outline above it. `page` is
 * one-based, as in `overlay()`.
 * @param {string} sourcePath - The PDF with at least two pages.
 * @param {string} outputPath - Where to write the new PDF.
 * @returns {void}
 */
function placePdfPageAsImage(sourcePath, outputPath) {
  new Recipe("new", outputPath)
    .createPage(595, 842)
    .image(sourcePath, 72, 72, {
      page: 2,
      width: 200,
      fill: "#f1f5f9",
      stroke: "#102a43",
      lineWidth: 2,
      dash: [4, 2],
    })
    .endPage()
    .endPDF();
}

module.exports = placePdfPageAsImage;
