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
      .Tf(
        writer.getFontForFile(
          path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
        ),
        12,
      )
      .Tm(1, 0, 0, 1, 20, 30)
      .Tj("Before")
      .ET()
      .writeFreeCode("% caf\u00e9\n");
    writer.writePage(page);
    writer.end();

    var recipe = new Recipe(source, output);
    expect(() => recipe.replaceText("Before", "After")).to.throw(
      "replaceText expects a positive integer page number",
    );
    expect(() => recipe.replaceText("Before", "After", 0)).to.throw(
      "replaceText expects a positive integer page number",
    );
    recipe.replaceText("Before", "After", 1).endPDF();

    var reader = muhammara.createReader(output);
    var text = reader.extractPageText(0);

    expect(text).to.have.lengthOf(1);
    expect(text[0].content).to.equal("After");
    expect(text[0].textMatrix).to.deep.equal([1, 0, 0, 1, 20, 30]);

    var contents = reader.queryDictionaryObject(
      reader.parsePage(0).getDictionary(),
      "Contents",
    );
    var streamReader = reader.startReadingFromStream(contents);
    var chunks = [];
    while (streamReader.notEnded()) {
      chunks.push(Buffer.from(streamReader.read(65536)));
    }
    expect(
      Buffer.concat(chunks).includes(Buffer.from("% caf\u00e9\n")),
    ).to.equal(true);
    reader.end();
  });
});
