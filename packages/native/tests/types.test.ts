import muhammara = require("@muhammara/native");
import nativeCore = require("@muhammara/native-core");

declare const writer: muhammara.PDFWriter;
declare const recipe: muhammara.Recipe;
var page: muhammara.PDFPage = writer.createPage(0, 0, 595, 842);
var context: muhammara.PageContentContext =
  writer.startPageContentContext(page);
var api: typeof muhammara = nativeCore.createMuhammara({});

context.m(0, 0).l(100, 100).S();
context.c(0, 0, 1, 1, 2, 2).S();
context.drawCircle(10, 10, 5).drawSquare(10, 10, 5);
api.createWriter("output.pdf");
api.getTypeLabel(api.ePDFObjectArray);
api.EInfoTrappedTrue;
recipe.read();
recipe.register("example", function () {});
recipe.createPage(595, 842, { left: 36 }).margins({ top: 36 });
recipe
  .table(0, 0, [{}])
  .ellipse(10, 10, 5, 3)
  .arc(10, 10, 5)
  .n_gon(10, 10, 5, { fill: "#000000" })
  .star(10, 10, 5, { fill: "#000000" })
  .triangle(10, 10, [1, 2, 3])
  .arrow(10, 10)
  .fill()
  .stroke()
  .fillAndStroke();
recipe.htmlToTextObjects("<p>text</p>");
recipe.endPDF();
var callbackResult: string = recipe.endPDF(function () {
  return "result";
});

void callbackResult;
