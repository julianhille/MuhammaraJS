import muhammara = require("@muhammara/native-with-source");

declare const writer: muhammara.PDFWriter;

var page: muhammara.PDFPage = writer.createPage(0, 0, 595, 842);
writer.startPageContentContext(page).c(0, 0, 1, 1, 2, 2).S();

var recrypted: Promise<void> = muhammara.recryptAsync("in.pdf", "out.pdf", {
  userPassword: "user",
});
void recrypted;
