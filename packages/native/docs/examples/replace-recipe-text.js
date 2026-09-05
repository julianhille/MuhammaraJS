var Recipe = require("@muhammara/native").Recipe;

function replaceRecipeText(inputPath, outputPath) {
  new Recipe(inputPath, outputPath).replaceText("Before", "After").endPDF();
}

module.exports = replaceRecipeText;
