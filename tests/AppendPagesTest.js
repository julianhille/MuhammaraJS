const muhammara = require("../lib/muhammara");
const Recipe = require("../lib/Recipe");
const expect = require("chai").expect;
const fs = require("fs");

describe("AppendPagesTest", function () {
  it("should complete without error", function () {
    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/AppendPagesTest.pdf",
    );
    pdfWriter.appendPDFPagesFromPDF(__dirname + "/TestMaterials/Original.pdf");
    pdfWriter.appendPDFPagesFromPDF(
      __dirname + "/TestMaterials/XObjectContent.PDF",
    );
    pdfWriter.appendPDFPagesFromPDF(
      __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
    );

    pdfWriter.end();
  });

  it("should throw an error instead of a crash", () => {
    var writerBuffer = new muhammara.PDFWStreamForBuffer([]);
    var pdfWriter = muhammara.createWriter(writerBuffer);
    expect(() =>
      pdfWriter.appendPDFPagesFromPDF(
        __dirname + "/TestMaterials/appendbreaks.pdf",
      ),
    ).to.throw("unable to append");
  });

  it("should free the file handle", () => {
    const testFile1 = __dirname + "/output/test1.pdf";
    const testFile2 = __dirname + "/output/test2.pdf";
    const resultFile = __dirname + "/output/result.pdf";
    fs.copyFileSync(__dirname + "/TestMaterials/Original.pdf", testFile1);
    fs.copyFileSync(__dirname + "/TestMaterials/Original.pdf", testFile2);

    const pdfDoc = new Recipe(testFile1, resultFile);
    pdfDoc.appendPage(testFile2).endPDF();

    // error here: Error: EBUSY: resource busy or locked, unlink
    fs.unlinkSync(testFile1);
    fs.unlinkSync(testFile2);
  });
});
