var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
var Recipe = muhammara.Recipe;

describe("Recipe default font", function () {
  it("writes text without registering a font", function () {
    var output = path.join(__dirname, "../output/default-font.pdf");
    new Recipe("new", output)
      .createPage("letter")
      .text("Hello", 72, 72)
      .endPage()
      .endPDF();
    var reader = muhammara.createReader(output);
    try {
      assert.deepStrictEqual(
        reader.extractPageText(0).map(function (item) {
          return item.content;
        }),
        ["Hello"],
      );
    } finally {
      reader.end();
    }
  });

  it("also offers the bundled Roboto family without registration", function () {
    var output = path.join(__dirname, "../output/default-font-roboto.pdf");
    new Recipe("new", output)
      .createPage("letter")
      .text("Café", 72, 72, { font: "Roboto" })
      .endPage()
      .endPDF();
    var reader = muhammara.createReader(output);
    try {
      assert.strictEqual(reader.extractPageText(0)[0].content, "Café");
    } finally {
      reader.end();
    }
  });
});
