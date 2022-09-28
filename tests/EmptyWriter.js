var muhammara = require("../muhammara");

describe("EmptyWriter", function () {
  it("should complete without error", function () {
    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/EmptyWriter.pdf",
      {
        version: muhammara.ePDFVersion14,
      }
    );
    pdfWriter.end();
  });
});
