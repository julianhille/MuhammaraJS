var Recipe = require("@muhammara/native").Recipe;

function addBookmarks(outputPath) {
  new Recipe("new", outputPath)
    .createPage("letter")
    .text("Introduction", 72, 72)
    .endPage()
    .createPage("letter")
    .text("Details", 72, 72)
    .endPage()
    .bookmark("Introduction", 1)
    .bookmark("Details", 2, {
      open: true,
      children: [
        { title: "Positioned", pageNumber: 2, x: 72, y: 144, zoom: 1.5 },
      ],
    })
    .endPDF();
}

module.exports = addBookmarks;
