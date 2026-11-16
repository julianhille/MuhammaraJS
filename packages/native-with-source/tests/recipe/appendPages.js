const path = require("path");
const fs = require("fs");
const { writeOutput } = require("../helpers/testOutput");
const muhammara = require("@muhammara/native-with-source");
const { expect } = require("chai");
const Recipe = muhammara.Recipe;

describe("Append Pages", () => {
  const taskAP = "Append pages from other pdf";
  it(taskAP, (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test.pdf");
    const longPDF = path.join(
      __dirname,
      "../TestMaterials/recipe/compressed.tracemonkey-pldi-09.pdf",
    );
    const output = path.join(__dirname, `../output/${taskAP}.pdf`);
    const recipe = new Recipe(src, output);
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

    new Recipe(source, output).appendPage(appended).endPDF();
    writeOutput("appendPages-handles-result", fs.readFileSync(output));

    // Windows refuses the unlink with EBUSY while a reader still holds the
    // file, which is what https://github.com/julianhille/MuhammaraJS/issues/381
    // reported.
    fs.unlinkSync(source);
    fs.unlinkSync(appended);
    fs.rmSync(output, { force: true });
  });

  it("appends a PDF with an empty user password to an existing PDF", () => {
    const appended = path.join(__dirname, "../output/appendPages-owner.pdf");
    const output = path.join(__dirname, "../output/appendPages-owner-out.pdf");
    const writer = muhammara.createWriter(appended, {
      userPassword: "",
      ownerPassword: "owner",
    });
    writer.writePage(writer.createPage(0, 0, 300, 300));
    writer.end();
    const material = path.join(__dirname, "../TestMaterials/recipe/test.pdf");
    new Recipe(material, output).appendPage(appended).endPDF();
    const pages = new Recipe(material).metadata.pages;
    expect(new Recipe(output).metadata.pages).to.equal(pages + 1);
  });
});
