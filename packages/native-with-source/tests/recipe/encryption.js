const path = require("path");
const assert = require("assert");
const fs = require("fs");
const muhammara = require("@muhammara/native-with-source");
const Recipe = require("@muhammara/native-with-source").Recipe;

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
  it("opens a source that needs its user password", () => {
    const recipe = new Recipe(
      path.join(__dirname, "../TestMaterials/ProtectedAES256.pdf"),
      path.join(__dirname, "../output/ProtectedAES256-info.pdf"),
      { password: "user" },
    );
    assert.equal(recipe.pageInfo(1).width, 200);
    // the Info of a source that needs its user password is not read
    assert.deepEqual(recipe.info(), {});
    assert.equal(recipe.xmp(), undefined);
    // the writer would encrypt new entries with a key that does not match
    assert.throws(() => recipe.endPDF(), {
      message:
        "Editing a password-protected source is unsupported; decrypt it with recrypt() first",
    });
  });

  it("reads and edits the Info of a source only an owner password protects", () => {
    var created = new Recipe(Buffer.from("new"), undefined, {
      password: "owner",
      title: "Original",
    });
    created.createPage(100, 100).endPage();
    var source = created.endPDF((output) => output);
    var recipe = new Recipe(source, undefined, { password: "owner" });
    assert.equal(recipe.info().title, "Original");
    assert.ok(recipe.xmp() === undefined);
    var edited = recipe.info({ author: "A" }).endPDF((output) => output);
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(edited),
    );
    try {
      var info = reader.queryDictionaryObject(reader.getTrailer(), "Info");
      assert.equal(info.queryObject("Title").toText(), "Original");
      assert.equal(info.queryObject("Author").toText(), "A");
      assert.match(
        info.queryObject("source-Producer").toText(),
        /^MuhammaraJS/,
      );
    } finally {
      reader.end();
    }
  });

  const taskAVP = "Add view password";
  it(taskAVP, (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test2.pdf");
    const output = path.join(__dirname, `../output/${taskAVP}.pdf`);
    fs.rmSync(output, { force: true });
    const recipe = new Recipe(src, output);
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

    const recipe = new Recipe(src, output);
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

    const recipe = new Recipe(src, output);
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
    const recipe = new Recipe("new", output, { userPassword: "123" });
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
    const recipe = new Recipe("new", output, { password: "123" });
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
    const recipe = new Recipe("new", output, {
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

  function assertBufferEncryption(buffer, password, encrypted) {
    const reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(buffer),
      password ? { password } : {},
    );
    try {
      assert.equal(reader.isEncrypted(), encrypted);
      assert.ok(reader.getPagesCount() > 0);
    } finally {
      reader.end();
    }
  }

  // GH-446: a Buffer source used to skip encrypt() and only log a message.
  const taskBVP = "Buffer source with view password";
  it(taskBVP, (done) => {
    const src = fs.readFileSync(
      path.join(__dirname, "../TestMaterials/recipe/test2.pdf"),
    );
    const recipe = new Recipe(src);
    recipe
      .editPage(1)
      .text("Encrypted from a Buffer source", 150, 300)
      .endPage()
      .encrypt({ userPassword: "123" })
      .endPDF((buffer) => {
        assert.ok(Buffer.isBuffer(buffer));
        fs.writeFileSync(
          path.join(__dirname, `../output/${taskBVP}.pdf`),
          buffer,
        );
        assertBufferEncryption(buffer, "123", true);
        const locked = muhammara.createReader(
          new muhammara.PDFRStreamForBuffer(buffer),
        );
        try {
          assert.equal(locked.isEncrypted(), true);
          assert.equal(locked.getPagesCount(), 0);
        } finally {
          locked.end();
        }
        // A repeated endPDF() hands out the same encrypted bytes.
        recipe.endPDF((again) => {
          assert.ok(again.equals(buffer));
          done();
        });
      });
  });

  const taskBOP = "Buffer source with output path and edit password";
  it(taskBOP, (done) => {
    const src = fs.readFileSync(
      path.join(__dirname, "../TestMaterials/recipe/test2.pdf"),
    );
    const output = path.join(__dirname, `../output/${taskBOP}.pdf`);
    fs.rmSync(output, { force: true });
    const recipe = new Recipe(src, output);
    recipe
      .encrypt({ ownerPassword: "123", userProtectionFlag: 4 })
      .endPDF((outputPath) => {
        assert.equal(outputPath, output);
        assertPdfEncryption(output, undefined, true);
        done();
      });
  });

  const taskBNP = "New Buffer file with encrypt()";
  it(taskBNP, (done) => {
    const recipe = new Recipe(Buffer.from("new"));
    recipe
      .createPage("letter")
      .text("encrypt() also works for a new Buffer PDF", 150, 300)
      .endPage()
      .encrypt({ userPassword: "123", ownerPassword: "456" })
      .endPDF((buffer) => {
        fs.writeFileSync(
          path.join(__dirname, `../output/${taskBNP}.pdf`),
          buffer,
        );
        assertBufferEncryption(buffer, "123", true);
        done();
      });
  });

  const taskCRE = "New file with constructor password re-encrypted";
  it(taskCRE, (done) => {
    const output = path.join(__dirname, `../output/${taskCRE}.pdf`);
    fs.rmSync(output, { force: true });
    const recipe = new Recipe("new", output, { userPassword: "first" });
    recipe
      .createPage("letter")
      .text("encrypt() replaces the constructor password", 150, 300)
      .endPage()
      .encrypt({ userPassword: "second" })
      .endPDF(() => {
        assertPdfEncryption(output, "second", true);
        assertPdfCannotBeReadWithoutPassword(output);
        done();
      });
  });

  const taskBRE = "New Buffer file with constructor password re-encrypted";
  it(taskBRE, (done) => {
    const recipe = new Recipe(Buffer.from("new"), undefined, {
      userPassword: "first",
    });
    recipe
      .createPage("letter")
      .text("encrypt() replaces the constructor password", 150, 300)
      .endPage()
      .encrypt({ userPassword: "second" })
      .endPDF((buffer) => {
        fs.writeFileSync(
          path.join(__dirname, `../output/${taskBRE}.pdf`),
          buffer,
        );
        assertBufferEncryption(buffer, "second", true);
        const stale = muhammara.createReader(
          new muhammara.PDFRStreamForBuffer(buffer),
          { password: "first" },
        );
        try {
          assert.equal(stale.getPagesCount(), 0);
        } finally {
          stale.end();
        }
        done();
      });
  });

  // GH-975: a userProtectionFlag alone encrypts a new PDF with an empty user
  // password, which endPDF() used to open with the encrypt() password.
  const taskBFRE = "New Buffer file with constructor flag re-encrypted";
  it(taskBFRE, (done) => {
    new Recipe(Buffer.from("new"), undefined, { userProtectionFlag: 4 })
      .createPage("letter")
      .endPage()
      .encrypt({ userPassword: "second" })
      .endPDF((buffer) => {
        assertBufferEncryption(buffer, "second", true);
        const locked = muhammara.createReader(
          new muhammara.PDFRStreamForBuffer(buffer),
        );
        try {
          assert.equal(locked.getPagesCount(), 0);
        } finally {
          locked.end();
        }
        done();
      });
  });

  const taskBNE = "Buffer source with empty encrypt() stays unencrypted";
  it(taskBNE, (done) => {
    const src = fs.readFileSync(
      path.join(__dirname, "../TestMaterials/recipe/test2.pdf"),
    );
    new Recipe(src).encrypt({}).endPDF((buffer) => {
      assertBufferEncryption(buffer, undefined, false);
      done();
    });
  });

  // GH-1003: an encrypted source is read only with its password.
  const taskESP = "Encrypted Buffer source needs its password";
  it(taskESP, () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../TestMaterials/PDFWithPassword.PDF"),
    );
    assert.throws(() => new Recipe(src), /pages=0/);
    assert.throws(
      () => new Recipe(src, undefined, { password: "wrong" }),
      /pages=0/,
    );
    const recipe = new Recipe(src, undefined, { password: "user" });
    assert.equal(recipe.pageInfo(1).width, 595);
    assert.equal(recipe.pageInfo(1).height, 842);
    const aes = fs.readFileSync(
      path.join(__dirname, "../TestMaterials/ProtectedAES256.pdf"),
    );
    const plain = fs.readFileSync(
      path.join(__dirname, "../TestMaterials/recipe/test2.pdf"),
    );
    assert.throws(() => new Recipe(plain).read(aes), /pages=0/);
    assert.equal(recipe.read(aes)[1].width, 200);
    const aesRecipe = new Recipe(aes, undefined, { password: "user" });
    assert.equal(aesRecipe.pageInfo(1).height, 300);
    // Editing stays unsupported, so no output is written over the encryption.
    assert.throws(
      () => aesRecipe.info({ title: "T" }).endPDF(() => {}),
      /Editing a password-protected source is unsupported/,
    );
    // An owner-password-only source opens without a password and stays editable.
    let ownerOnly;
    new Recipe(Buffer.from("new"), undefined, { ownerPassword: "own" })
      .createPage(100, 100)
      .endPage()
      .endPDF((buffer) => (ownerOnly = buffer));
    let edited;
    new Recipe(ownerOnly)
      .editPage(1)
      .text("Edited", 10, 10)
      .endPage()
      .endPDF((buffer) => (edited = buffer));
    assertBufferEncryption(edited, undefined, true);
  });

  // TODO: this seems to be broken
  // const taskMPF = 'Modify file with view password';
  // it(taskMPF, (done) => {
  //     const input = path.join(__dirname, `../output/${taskCPF}.pdf`);
  //     const output = path.join(__dirname, `../output/${taskMPF}.pdf`);
  //     const recipe = new Recipe(input, output, { userPassword: '123' });

  //     recipe
  //         .editPage(1)
  //         .text('The userPassword is also required to modify the file.', 150, 400)
  //         .endPage()
  //         .endPDF(done);
  // });
});
