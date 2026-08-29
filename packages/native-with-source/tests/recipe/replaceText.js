var expect = require("chai").expect;
var path = require("path");
var muhammara = require("../..");
var Recipe = muhammara.Recipe;

describe("Replace text", function () {
  it("replaces text at its existing position", function () {
    var source = path.join(__dirname, "../output/Replace text source.pdf");
    var output = path.join(__dirname, "../output/Replace text output.pdf");
    var writer = muhammara.createWriter(source);
    var page = writer.createPage(0, 0, 200, 200);

    writer
      .startPageContentContext(page)
      .BT()
      .Tf(writer.getFontForFile("../TestMaterials/fonts/arial.ttf"), 12)
      .Tm(1, 0, 0, 1, 20, 30)
      .Tj("Before")
      .ET();
    writer.writePage(page);
    writer.end();

    new Recipe(source, output).replaceText("Before", "After").endPDF();

    var reader = muhammara.createReader(output);
    var text = reader.extractPageText(0);

    expect(text).to.have.lengthOf(1);
    expect(text[0].content).to.equal("After");
    expect(text[0].textMatrix).to.deep.equal([1, 0, 0, 1, 20, 30]);
    reader.end();
  });
});
