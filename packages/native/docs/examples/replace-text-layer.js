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

module.exports = replaceTextLayer;
