const path = require("path");
const HummusRecipe = require("../../lib").Recipe;
const fs = require("fs");

describe("Split", () => {
  it("Split PDF", (done) => {
    const outputDir = path.join(__dirname, "../output/");
    const originalSrc = path.join(
      __dirname,
      "../TestMaterials/recipe/compressed.tracemonkey-pldi-09.pdf"
    );
    const src = path.join(
      outputDir,
      "split.compressed.tracemonkey-pldi-09.pdf"
    );
    fs.copyFileSync(originalSrc, src);
    const recipe = new HummusRecipe(src);
    return recipe.split(outputDir).endPDF(done);
  });
});
