var Recipe = require("@muhammara/native").Recipe;

function createRecipePdf(outputPath, callback) {
  new Recipe("new", outputPath).createPage("letter").endPage().endPDF(callback);
}

module.exports = createRecipePdf;
