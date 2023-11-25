var muhammara = require("../lib/muhammara");

describe("ModifyExistingPageContent", function () {
  it("should complete without error", function () {
    var pdfWriter = muhammara.createWriterToModify(
      __dirname + "/TestMaterials/BasicJPGImagesTest.PDF",
      {
        modifiedFilePath:
          __dirname + "/output/BasicJPGImagesTestPageModified.pdf",
      }
    );

    var pageModifier = new muhammara.PDFPageModifier(pdfWriter, 0);
    pageModifier
      .startContext()
      .getContext()
      .writeText("Test Text", 75, 805, {
        font: pdfWriter.getFontForFile(
          __dirname + "/TestMaterials/fonts/Couri.ttf"
        ),
        size: 14,
        colorspace: "gray",
        color: 0x00,
      });

    pageModifier.endContext().writePage();
    pdfWriter.end();
  });
});
