const muhammara = require("@muhammara/native-with-source");
const expect = require("chai").expect;

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
    expect(() => pdfWriter.createPage(0, 0, 100, 100)).to.throw(
      "PDF writer has ended",
    );
  });

  it("should retire modifiers after append failures", function () {
    var sources = [
      {
        name: "Malformed",
        value: new muhammara.PDFRStreamForBuffer(Buffer.from([1, 2, 3])),
      },
      {
        name: "Protected",
        value: __dirname + "/TestMaterials/Protected.pdf",
      },
    ];
    for (var source of sources) {
      var pdfWriter = muhammara.createWriterToModify(
        __dirname + "/TestMaterials/Original.pdf",
        {
          modifiedFilePath:
            __dirname + "/output/AppendPagesModify" + source.name + ".pdf",
        },
      );
      expect(() => pdfWriter.appendPDFPagesFromPDF(source.value)).to.throw(
        "unable to append",
      );
      expect(() => pdfWriter.createPage(0, 0, 100, 100)).to.throw(
        "PDF writer has ended",
      );
      expect(() =>
        pdfWriter.appendPDFPagesFromPDF(
          __dirname + "/TestMaterials/Original.pdf",
        ),
      ).to.throw("PDF writer has ended");
    }
  });

  it("should reject malformed appends to modifiers without hanging", function () {
    var targets = [
      {
        modifiedFilePath: __dirname + "/output/AppendPagesModifyBroken.pdf",
      },
      new muhammara.PDFWStreamForBuffer([]),
    ];
    for (var target of targets) {
      var pdfWriter =
        target instanceof muhammara.PDFWStreamForBuffer
          ? muhammara.createWriterToModify(
              new muhammara.PDFRStreamForFile(
                __dirname + "/TestMaterials/Original.pdf",
              ),
              target,
            )
          : muhammara.createWriterToModify(
              __dirname + "/TestMaterials/Original.pdf",
              target,
            );
      expect(() =>
        pdfWriter.appendPDFPagesFromPDF(
          __dirname + "/TestMaterials/appendbreaks.pdf",
        ),
      ).to.throw("unable to append");
      expect(() => pdfWriter.createPage(0, 0, 100, 100)).to.throw(
        "PDF writer has ended",
      );
    }
  });
});
