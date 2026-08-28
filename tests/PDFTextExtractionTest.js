var muhammara = require("../lib/muhammara");
var assert = require("chai").assert;

describe("PDFTextExtraction", function () {
  it("returns text operations and their active text state", function () {
    var output = __dirname + "/output/PDFTextExtraction.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    var font = writer.getFontForFile(
      __dirname + "/TestMaterials/fonts/arial.ttf",
    );
    var context = writer.startPageContentContext(page);
    context
      .BT()
      .Tf(font, 12)
      .Tm(1, 0, 0, 1, 25, 50)
      .Tj("first")
      .Tm(1, 0, 0, 1, 25, 75)
      .Tj("second")
      .ET();
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map(function (element) {
        return element.content;
      }),
      ["first", "second"],
    );
    assert.equal(elements[0].fontSize, 12);
    assert.deepEqual(elements[0].textMatrix, [1, 0, 0, 1, 25, 50]);
    assert.deepEqual(elements[1].textMatrix, [1, 0, 0, 1, 25, 75]);
  });
});
