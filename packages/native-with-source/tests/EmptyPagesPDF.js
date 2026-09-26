var assert = require("assert");
var muhammara = require("@muhammara/native-with-source");

describe("EmptyPagesTest", function () {
  it("should complete without error", function () {
    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/EmptyPages.pdf",
      { version: muhammara.ePDFVersion14 },
    );
    var page = pdfWriter.createPage();

    page.mediaBox = [0, 0, 595, 842];
    for (var i = 0; i < 4; ++i) {
      pdfWriter.writePage(page);
    }

    pdfWriter.end();
  });

  it("exports the value sets shared with Wasm as frozen objects", function () {
    // Same names and members as @muhammara/wasm; see its EmptyPagesPDF test.
    var valueSets = [
      [muhammara.DeviceColorSpace, ["rgb", "gray", "cmyk"]],
      [muhammara.ImageFit, ["always", "overflow"]],
      [muhammara.PageBox, ["media", "crop", "bleed", "trim", "art"]],
      [muhammara.EEncoding, ["text", "code", "hex"]],
      [muhammara.DrawingPathType, ["stroke", "fill", "clip"]],
      [muhammara.ObjectReplacementScope, ["global"]],
      [muhammara.PDFImageType, ["PDF", "JPG", "TIFF", "PNG"]],
      [muhammara.LineCapStyle, [0, 1, 2]],
      [muhammara.ETokenSeparator, [0, 1, 2]],
    ];
    valueSets.forEach(function (entry) {
      assert.deepEqual(Object.values(entry[0]), entry[1]);
      assert.ok(Object.isFrozen(entry[0]));
    });
  });
});
