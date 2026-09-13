import muhammara = require("@muhammara/native-with-source");

declare const writer: muhammara.PDFWriter;
declare const literalString: muhammara.PDFLiteralString;
declare const hexString: muhammara.PDFHexString;

var page: muhammara.PDFPage = writer.createPage(0, 0, 595, 842);
writer.startPageContentContext(page).c(0, 0, 1, 1, 2, 2).S();
var literalBytes: number[] = literalString.toBytesArray();
var hexBytes: number[] = hexString.toBytesArray();
var hexText: string = hexString.toText();
void literalBytes;
void hexBytes;
void hexText;

declare const recipe: muhammara.Recipe;
recipe
  .link("https://example.com", 100, 200, 160, 24)
  .comment("Please review.", 300, 100, {
    title: "Review",
    replies: [{ text: "Confirmed.", title: "Reviewer" }],
  })
  .annot(100, 200, "Highlight", { width: 200, height: 14, opacity: 0.45 })
  .annot(100, 230, "Highlight", { width: 200, height: 14, opacity: 0 });
recipe.opacity(0.5);
// @ts-expect-error Recipe.fillOpacity() was removed in v7.
recipe.fillOpacity(0.5);

recipe
  .text("Default size", 72, 72, { link: "https://text.example.com" })
  .text("Explicit size", 72, 100, { size: 12 })
  .pie(100, 100, 50, 20, 220, { fill: "#000000" });
recipe
  .registerFont("body", "./fonts/body-bold.ttf", "bold")
  .editPage(1)
  .overlay("overlay.pdf")
  .text("Flowing text", { layout: "article", flow: false })
  .text("Centered text", "center", "center")
  .image("photo.jpg", "center", "center");
recipe
  .text("Explicit styled size", 72, 100, {
    fontSize: 12,
    bold: true,
    italic: true,
  })
  .image("image.png", 72, 128, {
    link: "https://image.example.com",
    rotation: 45,
    rotationOrigin: [72, 128],
    skewX: 10,
    skewY: 5,
  })
  .rectangle(72, 180, 100, 20, { link: "https://shape.example.com" });
var textWidth: number = recipe.textDimensions("text").width;
recipe.textDimensions("text", { size: 12 }).width;
var pages: number = recipe.metadata.pages;
recipe.createPage(595, 842).rotate(90).endPage();
void textWidth;
void pages;
var currentPageInfo = recipe.getCurrentPageInfo();
var pageInfo: muhammara.RecipePageInfo = recipe.pageInfo(1);
currentPageInfo?.width;
currentPageInfo?.height;
currentPageInfo?.rotate;
currentPageInfo?.pageNumber;
pageInfo.width;

var info: muhammara.Recipe.InfoOptions = {
  author: "A",
  keywords: ["one", "two"],
  ReportId: "X-123",
  "2.16.76.1.4.2.2.1": "oid-professional",
  Labels: ["one", "two"],
};
recipe.info(info).custom("ReportId", "X-456").info({ ReportId: "X-789" });

recipe
  .register("drawMarker", function () {})
  .pauseContext()
  .resumeContext();
recipe
  .register(function drawNamedMarker() {})
  .pauseContext()
  .resumeContext();

var pageBox: muhammara.PDFPageBoxType = muhammara.ePDFPageBoxCropBox;
recipe.setPageBox(pageBox, 10, 20, 585, 822);
recipe.setPageBox(muhammara.ePDFPageBoxMediaBox, 0, 0, 595, 842);
void pageBox;
recipe.replaceText("Before", "After", 1);
// @ts-expect-error replaceText requires a one-based page number.
recipe.replaceText("Before", "After");
recipe.rotateContent(45, 10, 20);
recipe.lineStyle({
  width: 1,
  lineWidth: 2,
  cap: 1,
  join: 1,
  miterLimit: 2,
  dash: [1],
  dashPhase: 1,
});
recipe.deletePage(1).deletePage([2, 3]);
