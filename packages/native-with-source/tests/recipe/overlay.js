const path = require("path");
const fs = require("fs");
const { expect } = require("chai");
const { writeOutput } = require("../helpers/testOutput");
const muhammara = require("@muhammara/native-with-source");
const Recipe = muhammara.Recipe;

describe("Modify", () => {
  it("Add Overlay from other PDF", (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test2.pdf");
    const overlayPDF = path.join(
      __dirname,
      "../TestMaterials/recipe/test3.pdf",
    );
    const output = path.join(__dirname, "../output/Add overlay.pdf");

    const recipe = new Recipe(src, output);
    recipe.editPage(1).overlay(overlayPDF).endPage().endPDF(done);
  });

  it("Add Overlay from other PDF - position", (done) => {
    const src = path.join(
      __dirname,
      "../TestMaterials/recipe/issue-28-input.pdf",
    );
    const overlayPDF = path.join(
      __dirname,
      "../TestMaterials/recipe/test2.pdf",
    );
    const output = path.join(
      __dirname,
      "../output/Add overlay (#28) - position.pdf",
    );

    const recipe = new Recipe(src, output);
    const options = {};
    recipe
      .editPage(1)
      .overlay(overlayPDF, 500, 300, options)
      .endPage()
      .endPDF(done);
  });

  it("Add Overlay from other PDF - scale", (done) => {
    const src = path.join(
      __dirname,
      "../TestMaterials/recipe/issue-28-input.pdf",
    );
    const overlayPDF = path.join(
      __dirname,
      "../TestMaterials/recipe/test2.pdf",
    );
    const output = path.join(
      __dirname,
      "../output/Add overlay (#28) - scale.pdf",
    );

    const recipe = new Recipe(src, output);
    const options = {
      keepAspectRatio: true,
      scale: 3,
    };
    recipe.editPage(1).overlay(overlayPDF, options).endPage().endPDF(done);
  });

  it("Add Overlay from other PDF - fitWidth", (done) => {
    const src = path.join(
      __dirname,
      "../TestMaterials/recipe/issue-28-input.pdf",
    );
    const overlayPDF = path.join(
      __dirname,
      "../TestMaterials/recipe/test2.pdf",
    );
    const output = path.join(
      __dirname,
      "../output/Add overlay (#28) - fitWidth.pdf",
    );

    const recipe = new Recipe(src, output);
    const options = {
      keepAspectRatio: true,
      fitWidth: true,
    };
    recipe.editPage(1).overlay(overlayPDF, options).endPage().endPDF(done);
  });

  it("Add Overlay from other PDF - fitHeight", (done) => {
    const src = path.join(
      __dirname,
      "../TestMaterials/recipe/issue-28-input.pdf",
    );
    const overlayPDF = path.join(
      __dirname,
      "../TestMaterials/recipe/test2.pdf",
    );
    const output = path.join(
      __dirname,
      "../output/Add overlay (#28) - fitHeight.pdf",
    );

    const recipe = new Recipe(src, output);
    const options = {
      keepAspectRatio: true,
      fitHeight: true,
    };
    recipe.editPage(1).overlay(overlayPDF, options).endPage().endPDF(done);
  });

  it("Add Overlay from other PDF - stretch to fit", (done) => {
    const src = path.join(
      __dirname,
      "../TestMaterials/recipe/issue-28-input.pdf",
    );
    const overlayPDF = path.join(
      __dirname,
      "../TestMaterials/recipe/test2.pdf",
    );
    const output = path.join(
      __dirname,
      "../output/Add overlay (#28) - stretch.pdf",
    );

    const recipe = new Recipe(src, output);
    const options = {
      fitHeight: true,
      fitWidth: true,
    };
    recipe.editPage(1).overlay(overlayPDF, options).endPage().endPDF(done);
  });

  it("Add Overlay from other PDF w/ page_index", (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test2.pdf");
    const overlayPDF = path.join(
      __dirname,
      "../TestMaterials/recipe/test3.pdf",
    );
    const output = path.join(__dirname, "../output/Add overlay with page.pdf");

    const recipe = new Recipe(src, output);
    recipe.editPage(1).overlay(overlayPDF, { page: 1 }).endPage().endPDF(done);
  });

  it("Add Overlay from other PDF - position w/ page_index", (done) => {
    const src = path.join(
      __dirname,
      "../TestMaterials/recipe/issue-28-input.pdf",
    );
    const overlayPDF = path.join(
      __dirname,
      "../TestMaterials/recipe/test2.pdf",
    );
    const output = path.join(
      __dirname,
      "../output/Add overlay (#28) with page - position.pdf",
    );

    const recipe = new Recipe(src, output);
    const options = { page: 1 };
    recipe
      .editPage(1)
      .overlay(overlayPDF, 500, 300, options)
      .endPage()
      .endPDF(done);
  });

  it("Add Overlay from other PDF - scale w/ page_index", (done) => {
    const src = path.join(
      __dirname,
      "../TestMaterials/recipe/issue-28-input.pdf",
    );
    const overlayPDF = path.join(
      __dirname,
      "../TestMaterials/recipe/test2.pdf",
    );
    const output = path.join(
      __dirname,
      "../output/Add overlay (#28) with page - scale.pdf",
    );

    const recipe = new Recipe(src, output);
    const options = {
      keepAspectRatio: true,
      scale: 3,
      page: 2,
    };
    recipe.editPage(1).overlay(overlayPDF, options).endPage().endPDF(done);
  });

  it("Add Overlay from other PDF - fitWidth w/ page_index", (done) => {
    const src = path.join(
      __dirname,
      "../TestMaterials/recipe/issue-28-input.pdf",
    );
    const overlayPDF = path.join(
      __dirname,
      "../TestMaterials/recipe/test2.pdf",
    );
    const output = path.join(
      __dirname,
      "../output/Add overlay (#28) with page - fitWidth.pdf",
    );

    const recipe = new Recipe(src, output);
    const options = {
      keepAspectRatio: true,
      fitWidth: true,
      page: 2,
    };
    recipe.editPage(1).overlay(overlayPDF, options).endPage().endPDF(done);
  });

  it("Add Overlay from other PDF - fitHeight w/ page_index", (done) => {
    const src = path.join(
      __dirname,
      "../TestMaterials/recipe/issue-28-input.pdf",
    );
    const overlayPDF = path.join(
      __dirname,
      "../TestMaterials/recipe/test2.pdf",
    );
    const output = path.join(
      __dirname,
      "../output/Add overlay (#28) with page - fitHeight.pdf",
    );

    const recipe = new Recipe(src, output);
    const options = {
      keepAspectRatio: true,
      fitHeight: true,
      page: 1,
    };
    recipe.editPage(1).overlay(overlayPDF, options).endPage().endPDF(done);
  });

  it("Add Overlay from other PDF - stretch to fit  w/ page_index", (done) => {
    const src = path.join(
      __dirname,
      "../TestMaterials/recipe/issue-28-input.pdf",
    );
    const overlayPDF = path.join(
      __dirname,
      "../TestMaterials/recipe/test2.pdf",
    );
    const output = path.join(
      __dirname,
      "../output/Add overlay (#28) with page - stretch.pdf",
    );

    const recipe = new Recipe(src, output);
    const options = {
      fitHeight: true,
      fitWidth: true,
      page: 2,
    };
    recipe.editPage(1).overlay(overlayPDF, options).endPage().endPDF(done);
  });

  it("releases the overlaid file once the PDF is written", () => {
    const material = path.join(__dirname, "../TestMaterials/recipe/test.pdf");
    const source = path.join(__dirname, "../output/overlay-source.pdf");
    const overlaid = path.join(__dirname, "../output/overlay-overlaid.pdf");
    const output = path.join(__dirname, "../output/overlay-handles.pdf");
    fs.copyFileSync(material, source);
    fs.copyFileSync(material, overlaid);

    new Recipe(source, output).editPage(1).overlay(overlaid).endPage().endPDF();
    writeOutput("overlay-handles-result", fs.readFileSync(output));

    // Both files stay locked on Windows while a reader still holds them: #381.
    fs.unlinkSync(source);
    fs.unlinkSync(overlaid);
    fs.rmSync(output, { force: true });
  });

  it("overlays a PDF with an empty user password and rejects one that needs a password", () => {
    /**
     * Returns the path of a file in the test output folder.
     * @param {string} name - File name without extension.
     * @returns {string} The PDF path.
     */
    const output = (name) => path.join(__dirname, `../output/${name}.pdf`);
    /**
     * Writes a one-page encrypted PDF.
     * @param {string} name - Output file name without extension.
     * @param {object} options - createWriter encryption options.
     * @returns {string} The PDF path.
     */
    const writePdf = (name, options) => {
      const writer = muhammara.createWriter(output(name), options);
      writer.writePage(writer.createPage(0, 0, 100, 100));
      writer.end();
      return output(name);
    };
    /**
     * Counts the form XObjects in a written PDF.
     * @param {string} name - Output file name without extension.
     * @returns {number} The number of form XObjects.
     */
    const forms = (name) =>
      (fs.readFileSync(output(name), "latin1").match(/\/Subtype \/Form/g) || [])
        .length;
    const ownerOnlyPdf = writePdf("overlay-owner-password", {
      userPassword: "",
      ownerPassword: "owner",
    });
    const userPasswordPdf = writePdf("overlay-user-password", {
      userPassword: "user",
      ownerPassword: "owner",
      userProtectionFlag: 4,
    });
    new Recipe("new", output("overlay-password-source"))
      .createPage(100, 100)
      .endPage()
      .endPDF();
    [
      (name) => new Recipe("new", output(name)).createPage(100, 100),
      (name) =>
        new Recipe(output("overlay-password-source"), output(name)).editPage(1),
    ].forEach((start, index) => {
      const recipe = start(`overlay-owner-password-${index + 1}`);
      expect(() => recipe.overlay(userPasswordPdf)).to.throw(
        "Unable to read/edit PDF file",
      );
      recipe.overlay(ownerOnlyPdf).endPage().endPDF();
      start(`overlay-without-${index + 1}`)
        .endPage()
        .endPDF();
      expect(forms(`overlay-owner-password-${index + 1}`)).to.be.above(
        forms(`overlay-without-${index + 1}`),
      );
    });
  });
});
