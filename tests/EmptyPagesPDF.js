var muhammara = require("../muhammara");

describe("EmptyPagesTest", function () {
  it("should complete without error", function () {
    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/EmptyPages.pdf",
      { version: muhammara.ePDFVersion14 }
    );
    var page = pdfWriter.createPage();

    page.mediaBox = [0, 0, 595, 842];
    for (var i = 0; i < 4; ++i) {
      pdfWriter.writePage(page);
    }

    pdfWriter.end();
  });
});
