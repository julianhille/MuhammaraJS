const fs = require("fs");
const path = require("path");
const Recipe = require("@muhammara/native-with-source").Recipe;
const assert = require("chai").assert;

describe("Modify", () => {
  it("Change info pdf", (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/blank.pdf");
    const output = path.join(__dirname, "../output/change info.pdf");
    const recipe = new Recipe(src, output);
    recipe
      .info({
        author: "yo man" + new Date().toString(),
        title: "Hello World",
      })
      .custom("some", "thing?")
      .editPage(1)
      .comment("Feel free to open issues to help us!", "center", 100, {
        flag: "locked",
      })
      .endPage()
      .endPDF(() => {
        const info = new Recipe(output).info();
        assert.equal(info.title, "Hello World");
        done();
      });
  });
  it("Change info pdf", (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test-info.pdf");
    const output = path.join(
      __dirname,
      "../output/change info with IndirectObjectReference.pdf",
    );
    const recipe = new Recipe(src, output);
    recipe
      .info({
        author: "Me",
      })
      .endPDF(done);
  });
  it("keeps the source Trapped entry when saving", () => {
    const muhammara = require("@muhammara/native-with-source");
    const src = path.join(__dirname, "../TestMaterials/Linearized.pdf");
    const output = path.join(__dirname, "../output/keep trapped info.pdf");

    new Recipe(src, output).endPDF();

    const reader = muhammara.createReader(output);
    const info = reader.queryDictionaryObject(reader.getTrailer(), "Info");
    assert.equal(info.queryObject("Trapped").value, "False");
    assert.ok(info.queryObject("CreationDate").toText());
    reader.end();
  });
  [
    ["True", "True"],
    ["False", "False"],
    // PDFWriter omits /Trapped when it is Unknown, the PDF default.
    ["Unknown", undefined],
  ].forEach(([source, expected]) => {
    it(`keeps the source Trapped ${source} entry when saving`, () => {
      const muhammara = require("@muhammara/native-with-source");
      const src = path.join(__dirname, `../TestMaterials/Trapped${source}.pdf`);
      const output = path.join(
        __dirname,
        `../output/keep trapped ${source}.pdf`,
      );

      new Recipe(src, output).endPDF();

      const reader = muhammara.createReader(output);
      const info = reader.queryDictionaryObject(reader.getTrailer(), "Info");
      assert.equal(
        info.exists("Trapped") ? info.queryObject("Trapped").value : undefined,
        expected,
      );
      assert.equal(
        info.queryObject("CreationDate").toText(),
        "D:20200102030405+00'00'",
      );
      assert.equal(info.queryObject("Title").toText(), `Trapped ${source}`);
      assert.equal(info.queryObject("Author").toText(), "Source Author");
      assert.equal(info.queryObject("Subject").toText(), "Source Subject");
      assert.equal(info.queryObject("Keywords").toText(), "source, keywords");
      reader.end();
    });
  });
  it("lets info() override the source Title when saving", () => {
    const muhammara = require("@muhammara/native-with-source");
    const src = path.join(__dirname, "../TestMaterials/TrappedTrue.pdf");
    const output = path.join(__dirname, "../output/override source title.pdf");

    new Recipe(src, output).info({ title: "override" }).endPDF();

    const reader = muhammara.createReader(output);
    const info = reader.queryDictionaryObject(reader.getTrailer(), "Info");
    assert.equal(info.queryObject("Title").toText(), "override");
    reader.end();
  });
  it("print pdf structure", (done) => {
    const file = "test3";
    const src = path.join(__dirname, `../TestMaterials/recipe/${file}.pdf`);
    const output = path.join(__dirname, `../output/${file}.pdf`);
    const recipe = new Recipe(src, output);
    recipe
      .structure(path.join(__dirname, `../output/${file}.txt`))
      .endPDF(done);
  });
  it("prints the structure of a PDF without /Info", () => {
    const src = path.join(__dirname, "../TestMaterials/FontDifferences.pdf");
    const output = path.join(__dirname, "../output/structure-no-info.txt");
    new Recipe(src, path.join(__dirname, "../output/structure-no-info.pdf"))
      .structure(output)
      .endPDF();
    const structure = fs.readFileSync(output, "utf8");
    assert.notMatch(structure, /^Info\r$/m);
    assert.match(structure, /^Root\r$/m);
  });
  it("writes the golden structure tree of a shared fixture", () => {
    const dir = path.join(__dirname, "../TestMaterials/recipe");
    const output = path.join(__dirname, "../output/structure-info-mixed.txt");
    new Recipe(
      path.join(dir, "info-mixed.pdf"),
      path.join(__dirname, "../output/structure-info-mixed.pdf"),
    )
      .structure(output)
      .endPDF();
    assert.equal(
      fs.readFileSync(output, "utf8"),
      fs.readFileSync(path.join(dir, "info-mixed-structure.txt"), "utf8"),
    );
  });
  it("describes stream dictionaries and rejects structure() after endPDF()", () => {
    const output = path.join(__dirname, "../output/structure-stream.txt");
    const recipe = new Recipe(
      path.join(__dirname, "../TestMaterials/XObjectContent.PDF"),
      path.join(__dirname, "../output/structure-stream.pdf"),
    );
    recipe.structure(output);
    assert.match(
      fs.readFileSync(output, "utf8"),
      /Stream \. iterating stream dictionary:/,
    );
    recipe.endPDF();
    assert.throws(
      () => recipe.structure(output),
      /released by endPDF\(\)\. Read the source/,
    );
  });
  it("throws a no source PDF error when structure() is called on a new Recipe", () => {
    const output = path.join(__dirname, "../output/structure-new.txt");
    assert.throws(
      () =>
        new Recipe("new", path.join(__dirname, "../output/structure-new.pdf"))
          .createPage(100, 100)
          .endPage()
          .structure(output),
      /^The Recipe has no source PDF to read$/,
    );
  });
});
