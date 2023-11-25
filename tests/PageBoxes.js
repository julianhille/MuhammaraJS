var muhammara = require("../lib/muhammara"),
  assert = require("chai").assert;

describe("PagesBoxes", function () {
  it("should complete without error", function () {
    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/PageBoxes.pdf",
      { version: muhammara.ePDFVersion14 }
    );
    var page = pdfWriter.createPage();

    page.mediaBox = [0, 0, 595, 842];

    // crop box
    assert.equal(page.cropBox, undefined, "null crop box");
    page.cropBox = [1, 1, 594, 841];
    assert.deepEqual(page.cropBox, [1, 1, 594, 841], "defined crop box");

    // bleed box
    assert.equal(page.bleedBox, undefined, "null bleed box");
    page.bleedBox = [2, 2, 593, 840];
    assert.deepEqual(page.bleedBox, [2, 2, 593, 840], "defined bleed box");

    // trim box
    assert.equal(page.trimBox, undefined, "null trim box");
    page.trimBox = [3, 3, 592, 839];
    assert.deepEqual(page.trimBox, [3, 3, 592, 839], "defined trim box");

    // art box
    assert.equal(page.artBox, undefined, "null art box");
    page.artBox = [4, 4, 591, 838];
    assert.deepEqual(page.artBox, [4, 4, 591, 838], "defined art box");

    // rotate
    assert.equal(page.rotate, undefined, "null rotate");
    page.rotate = 90;
    assert.equal(page.rotate, 90, "defined rotate");

    pdfWriter.writePage(page);
    pdfWriter.end();
  });
});
