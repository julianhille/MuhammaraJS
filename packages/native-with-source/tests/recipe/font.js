const assert = require("node:assert/strict");
const path = require("path");
const Recipe = require("@muhammara/native-with-source").Recipe;

describe("Font", () => {
  it("Add text with custom fonts", (done) => {
    const output = path.join(
      __dirname,
      "../output/Add text with custom fonts.pdf",
    );
    const recipe = new Recipe("new", output, {
      fontSrcPath: path.join(__dirname, "../TestMaterials/fonts"),
    });
    recipe
      .createPage("letter")
      .text("世界你好 日本語", "center", 80, {
        font: "KozGoPro-Regular",
        textBox: { style: { fill: "%0,28,100,6" } },
      })
      .text("Lucida Grande from a font collection", "center", 120, {
        font: "LucidaGrande",
      })
      .endPage()
      .endPDF(done);
  });

  it("rejects a font name that is not registered", () => {
    const recipe = new Recipe(Buffer.from("new")).createPage("letter");
    assert.throws(
      () => recipe.text("x", 20, 20, { font: "PMingLiU" }),
      /Unknown font: PMingLiU/,
    );
  });
});
