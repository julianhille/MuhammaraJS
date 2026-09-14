var Recipe = require("@muhammara/native").Recipe;

function deletePages(inputPath, outputPath, pageNumbers) {
  new Recipe(inputPath, outputPath).deletePage(pageNumbers).endPDF();
}

module.exports = deletePages;
