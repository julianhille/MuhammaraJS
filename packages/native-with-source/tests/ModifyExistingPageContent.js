var assert = require("node:assert/strict");
var fs = require("node:fs");
var muhammara = require("@muhammara/native-with-source");

describe("ModifyExistingPageContent", function () {
  it("should complete without error", function () {
    var pdfWriter = muhammara.createWriterToModify(
      __dirname + "/TestMaterials/BasicJPGImagesTest.PDF",
      {
        modifiedFilePath:
          __dirname + "/output/BasicJPGImagesTestPageModified.pdf",
      },
    );

    var pageModifier = new muhammara.PDFPageModifier(pdfWriter, 0);
    pageModifier
      .startContext()
      .getContext()
      .writeText("Test Text", 75, 805, {
        font: pdfWriter.getFontForFile(
          __dirname + "/TestMaterials/fonts/Couri.ttf",
        ),
        size: 14,
        colorspace: "gray",
        color: 0x00,
      });

    pageModifier.endContext().writePage();
    pdfWriter.end();
  });

  it("keeps content from every restarted page context", function () {
    var output = __dirname + "/output/ModifyExistingPageContentRestarted.pdf";
    var pdfWriter = muhammara.createWriterToModify(
      __dirname + "/TestMaterials/BasicJPGImagesTest.PDF",
      { modifiedFilePath: output, compress: false },
    );
    var pageModifier = new muhammara.PDFPageModifier(pdfWriter, 0);
    pageModifier.startContext().getContext().re(10, 10, 5, 5).f();
    pageModifier.endContext();
    pageModifier.startContext().getContext().re(30, 30, 5, 5).f();
    pageModifier.endContext().writePage();
    pdfWriter.end();

    var bytes = fs.readFileSync(output, "latin1");
    assert.match(bytes, /10 10 5 5 re/);
    assert.match(bytes, /30 30 5 5 re/);
  });
});
