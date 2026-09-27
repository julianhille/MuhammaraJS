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

  it("keeps modifiers usable when the source cannot be appended", function () {
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
      // Nothing was written, so the writer continues.
      expect(
        pdfWriter.appendPDFPagesFromPDF(
          __dirname + "/TestMaterials/Original.pdf",
        ),
      ).to.have.length(2);
      pdfWriter.end();
      var reader = muhammara.createReader(
        __dirname + "/output/AppendPagesModify" + source.name + ".pdf",
      );
      expect(reader.getPagesCount()).to.equal(4);
      reader.end();
    }
  });

  it("keeps the writer usable when page ranges are outside the source", function () {
    var output = new muhammara.PDFWStreamForBuffer();
    var pdfWriter = muhammara.createWriter(output);
    var source = __dirname + "/TestMaterials/Original.pdf";
    [
      [[50, 60]],
      [[1, 0]],
      [
        [0, 0],
        [5, 6],
      ],
    ].forEach(function (specificRanges) {
      expect(() =>
        pdfWriter.appendPDFPagesFromPDF(source, {
          type: muhammara.eRangeTypeSpecific,
          specificRanges: specificRanges,
        }),
      ).to.throw("unable to append");
    });
    expect(() => pdfWriter.appendPDFPagesFromPDF("/missing.pdf")).to.throw(
      "unable to append",
    );
    expect(
      pdfWriter.appendPDFPagesFromPDF(
        new muhammara.PDFRStreamForBuffer(require("fs").readFileSync(source)),
        { type: muhammara.eRangeTypeSpecific, specificRanges: [[1, 1]] },
      ),
    ).to.have.length(1);
    pdfWriter.end();
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(output.buffer),
    );
    expect(reader.getPagesCount()).to.equal(1);
    reader.end();
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
