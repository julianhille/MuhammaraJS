import muhammara = require("@muhammara/native-with-source");

declare const writer: muhammara.PDFWriter;

var page: muhammara.PDFPage = writer.createPage(0, 0, 595, 842);
writer.startPageContentContext(page).c(0, 0, 1, 1, 2, 2).S();

declare const recipe: muhammara.Recipe;
recipe
  .comment("Please review.", 300, 100, {
    title: "Review",
    replies: [{ text: "Confirmed.", title: "Reviewer" }],
  })
  .annot(100, 200, "Highlight", { width: 200, height: 14, opacity: 0.45 })
  .annot(100, 230, "Highlight", { width: 200, height: 14, opacity: 0 });

recipe
  .text("Default size", 72, 72)
  .text("Explicit size", 72, 100, { size: 12 });
var textWidth: number = recipe.textDimensions("text").width;
recipe.textDimensions("text", { size: 12 }).width;
void textWidth;
