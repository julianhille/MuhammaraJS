const path = require("path");
const assert = require("assert");
const fs = require("fs");
const muhammara = require("@muhammara/native-with-source");
const HummusRecipe = require("@muhammara/native-with-source").Recipe;

function assertPdfEncryption(filePath, password, encrypted) {
  const reader = muhammara.createReader(filePath, password ? { password } : {});
  try {
    assert.equal(reader.isEncrypted(), encrypted);
    assert.ok(reader.getPagesCount() > 0);
  } finally {
    reader.end();
  }
}

function assertPdfCannotBeReadWithoutPassword(filePath) {
  const reader = muhammara.createReader(filePath);
  try {
    assert.equal(reader.isEncrypted(), true);
    assert.equal(reader.getPagesCount(), 0);
  } finally {
    reader.end();
  }
}

describe("Encryption", () => {
  const taskAVP = "Add view password";
  it(taskAVP, (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test2.pdf");
    const output = path.join(__dirname, `../output/${taskAVP}.pdf`);
    fs.rmSync(output, { force: true });
    const recipe = new HummusRecipe(src, output);
    recipe
      .encrypt({
        userPassword: "123",
      })
      .endPDF(() => {
        assertPdfEncryption(output, "123", true);
        assertPdfCannotBeReadWithoutPassword(output);
        done();
      });
  });

  const taskAEP = "Add edit password";
  it(taskAEP, (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test2.pdf");
    // const overlayPDF = path.join(__dirname, '../TestMaterials/recipe/test3.pdf');
    const output = path.join(__dirname, `../output/${taskAEP}.pdf`);
    fs.rmSync(output, { force: true });

    const recipe = new HummusRecipe(src, output);
    recipe
      .encrypt({
        ownerPassword: "123",
      })
      .endPDF(() => {
        assertPdfEncryption(output, undefined, true);
        done();
      });
  });

  const taskAPP = "Add permission password";
  it(taskAPP, (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test2.pdf");
    // const overlayPDF = path.join(__dirname, '../TestMaterials/recipe/test3.pdf');
    const output = path.join(__dirname, `../output/${taskAPP}.pdf`);
    fs.rmSync(output, { force: true });

    const recipe = new HummusRecipe(src, output);
    recipe
      .encrypt({
        password: "123",
      })
      .endPDF(() => {
        assertPdfEncryption(output, undefined, true);
        done();
      });
  });

  const taskCPF = "New file with view password";
  it(taskCPF, (done) => {
    const output = path.join(__dirname, `../output/${taskCPF}.pdf`);
    fs.rmSync(output, { force: true });
    const recipe = new HummusRecipe("new", output, { userPassword: "123" });
    recipe
      .createPage("letter")
      .text("When creating file, the viewing password (userPassword)", 150, 300)
      .text("is required for file encryption to occur.", 150, 350)
      .endPage()
      .endPDF(() => {
        assertPdfEncryption(output, "123", true);
        done();
      });
  });

  const taskCPP = "New file with permission password";
  it(taskCPP, (done) => {
    const output = path.join(__dirname, `../output/${taskCPP}.pdf`);
    fs.rmSync(output, { force: true });
    const recipe = new HummusRecipe("new", output, { password: "123" });
    recipe
      .createPage("letter")
      .text(
        "When creating file, an empty viewing password (userPassword)",
        150,
        300,
      )
      .text("is required for file encryption to occur.", 150, 350)
      .endPage()
      .endPDF(() => {
        assertPdfEncryption(output, undefined, true);
        done();
      });
  });

  const taskCPE = "New file with edit password";
  it(taskCPE, (done) => {
    const output = path.join(__dirname, `../output/${taskCPE}.pdf`);
    fs.rmSync(output, { force: true });
    const recipe = new HummusRecipe("new", output, {
      ownerPassword: "123",
      userProtectionFlag: 3900,
    });
    recipe
      .createPage("letter")
      .text(
        "When creating file, an empty viewing password (userPassword)",
        150,
        300,
      )
      .text("is required for file encryption to occur.", 150, 350)
      .endPage()
      .endPDF(() => {
        assertPdfEncryption(output, undefined, true);
        done();
      });
  });

  // TODO: this seems to be broken
  // const taskMPF = 'Modify file with view password';
  // it(taskMPF, (done) => {
  //     const input = path.join(__dirname, `../output/${taskCPF}.pdf`);
  //     const output = path.join(__dirname, `../output/${taskMPF}.pdf`);
  //     const recipe = new HummusRecipe(input, output, { userPassword: '123' });

  //     recipe
  //         .editPage(1)
  //         .text('The userPassword is also required to modify the file.', 150, 400)
  //         .endPage()
  //         .endPDF(done);
  // });
});
