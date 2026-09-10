import muhammara = require("@muhammara/native");
import nativeCore = require("@muhammara/native-core");

declare const writer: muhammara.PDFWriter;
declare const recipe: muhammara.Recipe;
declare const objects: muhammara.ObjectsContext;
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
api.ePDFVersionUndefined;
api.KProcsetImageB;
api.KProcsetImageC;
api.KProcsetImageI;
api.kProcsetPDF;
api.kProcsetText;
api.eXrefEntryExisting;
api.eXrefEntryDelete;
api.eXrefEntryStreamObject;
api.eXrefEntryUndefined;
context.J(api.LineCapStyle.LINECAP_BUTT).j(2);
objects.endArray(api.ETokenSeparator.eTokenSeparatorEndLine);
recipe.read();
recipe
  .comment("Please review.", 300, 100, {
    title: "Review",
    replies: [{ text: "Confirmed.", title: "Reviewer" }],
  })
  .annot(100, 200, "Highlight", { width: 200, height: 14, opacity: 0.45 })
  .annot(100, 230, "Highlight", { width: 200, height: 14, opacity: 0 });
var info: muhammara.Recipe.InfoOptions = {
  author: "A",
  keywords: ["one", "two"],
  ReportId: "X-123",
  "2.16.76.1.4.2.2.1": "oid-professional",
  Labels: ["one", "two"],
};
recipe.info(info).custom("ReportId", "X-456").info({ ReportId: "X-789" });
recipe.register("example", function () {});
recipe.createPage(595, 842, { left: 36 }).margins({ top: 36 });
var pageBox: muhammara.PDFPageBoxType = muhammara.ePDFPageBoxCropBox;
recipe.setPageBox(pageBox, 10, 20, 585, 822);
recipe.setPageBox(muhammara.ePDFPageBoxMediaBox, 0, 0, 595, 842);
recipe.rotate(90).endPage();
var margins: Required<muhammara.Recipe.RecipeMargins> = recipe.margins();
var title: string = recipe.getPageInfo().title;
var textWidth: number = recipe.textDimensions("text").width;
recipe.textDimensions("text", { size: 12 }).width;
recipe
  .text("Default size", 72, 72)
  .text("Explicit size", 72, 100, { size: 12 });
recipe
  .registerFont("body", "./fonts/body-bold.ttf", "bold")
  .editPage(1)
  .overlay("overlay.pdf")
  .text("Flowing text", { layout: "article", flow: false })
  .text("Centered text", "center", "center")
  .image("photo.jpg", "center", "center");
var pages: number = recipe.metadata.pages;
recipe
  .text("Explicit styled size", 72, 100, {
    fontSize: 12,
    bold: true,
    italic: true,
  })
  .image("image.png", 72, 128, {
    rotation: 45,
    rotationOrigin: [72, 128],
    skewX: 10,
    skewY: 5,
  });
var coordinates: muhammara.Recipe | number[] = recipe.movedown(1, Boolean(1));
recipe.structure("structure.json").endPDF();
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
recipe.opacity(0.5);
// @ts-expect-error Recipe.fillOpacity() was removed in v7.
recipe.fillOpacity(0.5);
recipe.htmlToTextObjects("<p>text</p>");
recipe.endPDF();
var callbackResult: string = recipe.endPDF(function () {
  return "result";
});

void callbackResult;
void margins;
void title;
void textWidth;
void pages;
void coordinates;
void pageBox;
