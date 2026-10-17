const path = require("path");
const { writeOutput } = require("../helpers/testOutput");
const fs = require("fs");
const assert = require("chai").assert;
const Recipe = require("@muhammara/native-with-source").Recipe;

describe("Modify", () => {
  it("Create Writer With buffer", (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test.pdf");
    const myCats = path.join(__dirname, "../TestMaterials/recipe/myCats.jpg");
    const buffer = fs.readFileSync(src);
    const recipe = new Recipe(buffer);
    recipe
      .editPage(1)
      .image(myCats, "center", "center", {
        width: 300,
        height: 300,
        keepAspectRatio: false,
        opacity: 0.4,
        align: "center center",
      })
      .annot("center", "center", "Square", {
        text: "yo, I am a square",
        width: 200,
        height: 100,
        border: 10,
        color: [128, 31, 80],
      })
      .endPage()
      .endPDF((outBuffer) => {
        assert(outBuffer instanceof Buffer);
        writeOutput("createWithBuffer", outBuffer);
        done();
      });
  });

  it("Create Writer With buffer and file output", (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test.pdf");
    const output = path.join(
      __dirname,
      "../output/createWithBufferAndFileOutput.pdf",
    );
    const myCats = path.join(__dirname, "../TestMaterials/recipe/myCats.jpg");
    const buffer = fs.readFileSync(src);
    const recipe = new Recipe(buffer, output);
    recipe
      .editPage(1)
      .image(myCats, "center", "center", {
        width: 300,
        height: 300,
        keepAspectRatio: false,
        opacity: 0.4,
        align: "center center",
      })
      .annot("center", "center", "Square", {
        text: "yo, I am a square",
        width: 200,
        height: 100,
        border: 10,
        color: [128, 31, 80],
      })
      .endPage()
      .endPDF((result) => {
        assert.equal(output, result);
        assert.equal(fs.existsSync(output), true);
        done();
      });
  });

  it("Create new Writer With new buffer and file output", (done) => {
    const pdfDoc = new Recipe(Buffer.from("new"), null, {
      version: 1.6,
      author: "John Doe",
      title: "Muhammara-Recipe",
      subject: "A brand new PDF",
    });
    const pdfBuffer = pdfDoc
      .createPage("letter")
      .endPage()
      .endPDF((outBuffer) => {
        assert(outBuffer instanceof Buffer);
        writeOutput("createWithNewBuffer", outBuffer);
        done();
      });
  });

  it("writes the requested PDF version to a new Buffer PDF", () => {
    const recipe = new Recipe(Buffer.from("new"), null, { version: 1.4 });
    recipe.createPage(100, 100).endPage();
    let outBuffer;
    recipe.endPDF((buffer) => {
      outBuffer = buffer;
    });
    writeOutput("createWithBuffer-version-1-4", outBuffer);
    assert.equal(outBuffer.subarray(0, 8).toString(), "%PDF-1.4");
  });

  it("opens the same PDF from a path, Buffer, Uint8Array and ArrayBuffer", () => {
    const src = path.join(__dirname, "../TestMaterials/Original.pdf");
    const buffer = fs.readFileSync(src);
    // An offset view checks that only the viewed bytes are read
    const padded = new Uint8Array(buffer.length + 8);
    padded.set(buffer, 4);
    const sources = [
      buffer,
      padded.subarray(4, 4 + buffer.length),
      new Uint8Array(buffer).buffer,
    ];
    const pages = new Recipe(src).read().pages;
    sources.forEach((source) => {
      const recipe = new Recipe(source);
      assert.deepEqual(recipe.read().pages, pages);
      let outBuffer;
      recipe.endPDF((result) => {
        outBuffer = result;
      });
      assert.equal(outBuffer.subarray(0, 5).toString(), "%PDF-");
    });
  });

  it("rejects a source that is neither a path nor bytes", () => {
    [undefined, 42, {}].forEach((source) => {
      assert.throws(
        () => new Recipe(source),
        TypeError,
        "Recipe source must be a path string, Buffer, Uint8Array or ArrayBuffer",
      );
    });
  });

  it("reads another PDF instead of the Buffer source", () => {
    const other = path.join(
      __dirname,
      "../TestMaterials/BasicTIFFImagesTest.PDF",
    );
    const recipe = new Recipe(
      fs.readFileSync(path.join(__dirname, "../TestMaterials/Original.pdf")),
    );
    const ownPages = recipe.read().pages;
    assert.notEqual(recipe.read(other).pages, ownPages);
    const otherBuffer = fs.readFileSync(other);
    [
      otherBuffer,
      new Uint8Array(otherBuffer),
      new Uint8Array(otherBuffer).buffer,
    ].forEach((source) => {
      assert.equal(recipe.read(source).pages, recipe.read(other).pages);
    });
    assert.throws(
      () => recipe.read(42),
      TypeError,
      "Recipe source must be a path string, Buffer, Uint8Array or ArrayBuffer",
    );
    assert.equal(recipe.metadata.pages, ownPages);
  });
});
