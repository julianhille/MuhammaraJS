const path = require("path");
const fs = require("fs");
const HummusRecipe = require("@muhammara/native-with-source").Recipe;

describe("Append Pages", () => {
  const taskAP = "Append pages from other pdf";
  it(taskAP, (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test.pdf");
    const longPDF = path.join(
      __dirname,
      "../TestMaterials/recipe/compressed.tracemonkey-pldi-09.pdf",
    );
    const output = path.join(__dirname, `../output/${taskAP}.pdf`);
    const recipe = new HummusRecipe(src, output);
    recipe
      .appendPage(longPDF, 10)
      .appendPage(longPDF, [4, 6])
      .appendPage(longPDF, [
        [1, 3],
        [6, 20],
      ])
      .appendPage(longPDF)
      .endPDF(done);
  });

  it("releases the input files once the PDF is written", () => {
    const source = path.join(__dirname, "../output/appendPages-source.pdf");
    const appended = path.join(__dirname, "../output/appendPages-appended.pdf");
    const output = path.join(__dirname, "../output/appendPages-handles.pdf");
    const material = path.join(__dirname, "../TestMaterials/recipe/test.pdf");
    fs.copyFileSync(material, source);
    fs.copyFileSync(material, appended);

    new HummusRecipe(source, output).appendPage(appended).endPDF();

    // Windows refuses the unlink with EBUSY while a reader still holds the
    // file, which is what https://github.com/julianhille/MuhammaraJS/issues/381
    // reported.
    fs.unlinkSync(source);
    fs.unlinkSync(appended);
    fs.rmSync(output, { force: true });
  });
});
