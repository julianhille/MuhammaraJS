const muhammara = require("../lib/muhammara");
const expect = require("chai").expect;

// Regression test for a bug in ParseExistingInDirectStreamObject: resolving an
// indirect /Length that lives at a non-first index of a compressed object
// stream (PDF 1.5+ /ObjStm) could silently misread the wrong bytes and throw
// "unable to append to page, make sure source file exists" while merging a
// later page. The fixture is a minimal, hand-built 2-page PDF (no external
// tools involved in producing it) where page 1's content stream's /Length is
// the first object packed into a shared ObjStm and page 2's /Length is the
// second -- reproducing the failure without depending on any particular PDF
// producer.
describe("ObjectStreamNonFirstIndexLengthTest", function () {
  it("should merge every page of a PDF whose /Length values are packed at non-first indices of a shared compressed object stream", function () {
    var file =
      __dirname + "/TestMaterials/ObjectStreamNonFirstIndexLength.pdf";
    var pdfReader = muhammara.createReader(file);
    var pageCount = pdfReader.getPagesCount();
    expect(pageCount).to.equal(2);

    for (var i = 0; i < pageCount; i += 1) {
      var pdfWriter = muhammara.createWriter(
        __dirname + "/output/ObjectStreamNonFirstIndexLengthTest" + i + ".pdf",
      );
      var parsedPage = pdfReader.parsePage(i);
      var cropBox = parsedPage.getCropBox();
      var page = pdfWriter.createPage(
        cropBox[0],
        cropBox[1],
        cropBox[2],
        cropBox[3],
      );

      expect(() =>
        pdfWriter.mergePDFPagesToPage(page, file, {
          type: muhammara.eRangeTypeSpecific,
          specificRanges: [[i, i]],
        }),
      ).to.not.throw();

      pdfWriter.writePage(page);
      pdfWriter.end();
    }
  });
});
