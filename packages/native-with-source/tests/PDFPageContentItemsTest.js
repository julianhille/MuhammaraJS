var muhammara = require("@muhammara/native-with-source");
var assert = require("chai").assert;

describe("PDFPageContentItems", function () {
  it("returns page-marking operations without relying on resources", function () {
    var output = __dirname + "/output/PDFPageContentItems.pdf";
    var writer = muhammara.createWriter(output);
    var font = writer.getFontForFile(
      __dirname + "/TestMaterials/fonts/arial.ttf",
    );

    writer.writePage(writer.createPage(0, 0, 200, 200));

    var pathPage = writer.createPage(0, 0, 200, 200);
    writer.startPageContentContext(pathPage).re(20, 20, 40, 40).f();
    writer.writePage(pathPage);

    var textPage = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(textPage)
      .BT()
      .rg(1, 1, 1)
      .Tf(font, 12)
      .Tm(1, 0, 0, 1, 25, 50)
      .Tj("white text")
      .Tr(3)
      .Tj("invisible text")
      .ET();
    writer.writePage(textPage).end();

    var reader = muhammara.createReader(output);
    var emptyItems = reader.extractPageContentItems(0);
    var pathItems = reader.extractPageContentItems(1);
    var textItems = reader.extractPageContentItems(2);
    reader.end();

    assert.deepEqual(emptyItems, []);
    assert.deepEqual(pathItems, [
      { type: muhammara.ePDFPageContentItemPath, operation: "f" },
    ]);
    assert.deepEqual(textItems, [
      { type: muhammara.ePDFPageContentItemText, operation: "Tj" },
    ]);
  });
});
