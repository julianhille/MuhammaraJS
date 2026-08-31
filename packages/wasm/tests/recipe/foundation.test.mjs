import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRecipe, createMuhammaraWasm } from "../../index.js";

describe("Recipe foundation", function () {
  it("uses Letter defaults, incremental margins, and named page sizes", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe();
    recipe.createPage();
    assert.deepEqual(recipe.pageInfo(1).mediaBox, [0, 0, 612, 792]);
    assert.deepEqual(recipe.margins(), {
      left: 72,
      right: 72,
      top: 72,
      bottom: 72,
    });
    recipe.margins({ left: 36 });
    assert.deepEqual(recipe.margins(), {
      left: 36,
      right: 72,
      top: 72,
      bottom: 72,
    });
    assert.deepEqual(recipe.position, { x: 0, y: 0 });
    recipe.endPage().createPage("a4", 90).endPage();
    assert.deepEqual(recipe.pageInfo(2).size, [595.28, 841.89]);
    recipe.endPDF();
  });

  it("normalizes center coordinates against the current media box", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe().createPage(200, 300);
    recipe.setPageBox("media", 10, 20, 210, 320);
    assert.deepEqual(recipe._calibrateCoordinate("center", "center"), {
      nx: 110,
      ny: 170,
    });
    assert.deepEqual(recipe._reverseCoordinate(110, 170), { ox: 100, oy: 150 });
    assert.deepEqual(recipe.pageInfo(1).mediaBox, [10, 20, 210, 320]);
    recipe.endPage().endPDF();
  });

  it("uses canonical Recipe versions and retains completed callback bytes", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe({ version: 2.0, compress: false })
      .createPage()
      .endPage();
    var callbackBytes;
    var bytes = recipe.endPDF((result) => {
      callbackBytes = result;
    });
    assert.ok(bytes instanceof Uint8Array);
    assert.strictEqual(callbackBytes, bytes);
    assert.strictEqual(recipe.endPDF(), bytes);
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(bytes);
    assert.equal(reader.getPDFLevel(), 1.7);
    reader.end();
    assert.match(new TextDecoder().decode(bytes), /\/CreationDate \(D:/);
    assert.match(new TextDecoder().decode(bytes), /\/ModDate \(D:/);
    assert.match(new TextDecoder().decode(bytes), /\/Producer \(MuhammaraJS/);
    assert.match(new TextDecoder().decode(bytes), /\/Creator \(Hummus-Recipe/);

    var modified = new Recipe(bytes).editPage(1).endPage().endPDF();
    var modifiedText = new TextDecoder().decode(modified);
    assert.match(modifiedText, /\/source-ModDate \(D:/);
    assert.match(modifiedText, /\/source-Creator \(Hummus-Recipe/);
    assert.match(modifiedText, /\/source-Producer \(MuhammaraJS/);
  });

  it("reads byte PDFs, edits an existing page across paused contexts, and returns bytes", async function () {
    var Recipe = await createRecipe();
    var source = new Recipe({ compress: false })
      .createPage(200, 300)
      .rectangle(10, 10, 20, 20, { fill: "#000000" })
      .endPage()
      .endPDF();
    var recipe = new Recipe({ compress: false });
    assert.equal(recipe.read(source).pages, 1);
    assert.equal(recipe.pageInfo(1), null);
    recipe = new Recipe(source, { compress: false });
    assert.deepEqual(recipe.pageInfo(1).mediaBox, [0, 0, 200, 300]);
    recipe
      .editPage(1)
      .rectangle(30, 30, 20, 20, { fill: "#000000" })
      .pauseContext()
      .resumeContext()
      .rectangle(60, 60, 20, 20, { fill: "#000000" })
      .endPage();
    var bytes = recipe.endPDF();
    assert.ok(bytes instanceof Uint8Array);
    var reader = (await createMuhammaraWasm()).createReader(bytes);
    assert.equal(reader.getPagesCount(), 1);
    var contents = reader
      .parsePage(0)
      .getDictionary()
      .toPDFDictionary()
      .queryObject("Contents");
    var contentObject = contents.toPDFIndirectObjectReference()
      ? reader.parseNewObject(
          contents.toPDFIndirectObjectReference().getObjectID(),
        )
      : contents;
    assert.ok(
      contentObject.toPDFArray()?.getLength() >= 3,
      "original content is retained before both appended edit contexts",
    );
    reader.end();
  });

  it("creates pages after reading byte source PDFs", async function () {
    var Recipe = await createRecipe();
    var source = new Recipe().createPage(200, 300).endPage().endPDF();
    var recipe = new Recipe(source).createPage(400, 500).endPage();
    assert.deepEqual(recipe.pageInfo(2).mediaBox, [0, 0, 400, 500]);
    assert.deepEqual(recipe.position, { x: 0, y: 0 });
    var reader = (await createMuhammaraWasm()).createReader(recipe.endPDF());
    assert.equal(reader.getPagesCount(), 2);
    assert.deepEqual(reader.getPageInfo(1).mediaBox, [0, 0, 400, 500]);
    reader.end();
  });

  it("requires bytes synchronously and rejects invalid edit lifecycle calls", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe();
    assert.throws(() => recipe.read(new Blob()), /Async API/);
    assert.throws(() => recipe.editPage(1), /constructed from PDF bytes/);
    assert.throws(() => recipe.pauseContext(), /No active page/);
    var source = new Recipe().createPage().endPage().endPDF();
    recipe = new Recipe(source);
    assert.throws(() => recipe.editPage(2), /pageNumber/);
    recipe.editPage(1);
    assert.throws(() => recipe.endPDF(), /Finish the current page/);
    recipe.endPage().endPDF();
  });

  it("inspects Blob input asynchronously without entering source mode", async function () {
    var Recipe = await createRecipe();
    var source = new Recipe().createPage().endPage().endPDF();
    var recipe = new Recipe();
    var metadata = await recipe.readAsync(new Blob([source]));
    assert.equal(metadata.pages, 1);
    assert.throws(() => recipe.editPage(1), /constructed from PDF bytes/);
    recipe.createPage().endPage().endPDF();
  });

  it("registers byte fonts by family and selects their requested style", async function () {
    var Recipe = await createRecipe();
    var font = new Uint8Array(
      await readFile("tests/TestMaterials/fonts/arial.ttf"),
    );
    Recipe.registerFont("Arial", font, "regular");
    Recipe.registerFont("Arial", font, "bold");
    var recipe = new Recipe();
    assert.ok(
      recipe.textDimensions("styled", { font: "arial", bold: true }).width > 0,
    );
    recipe.endPDF();
  });

  it("uses explicit async byte asset APIs and rejects paths and encryption", async function () {
    var Recipe = await createRecipe();
    var font = new Uint8Array(
      await readFile("tests/TestMaterials/fonts/arial.ttf"),
    );
    var source = new Recipe().createPage().endPage().endPDF();
    await Recipe.registerFontAsync("async-font", new Blob([font]), "italic");
    await Recipe.registerImageAsync("async-image", new Blob([font]), "png");
    await Recipe.registerPdfAsync("async-pdf", new Blob([source]));
    assert.throws(() => new Recipe("input.pdf"), /options must be an object/);
    assert.throws(() => Recipe.registerPdf("path", "input.pdf"), /Uint8Array/);
    assert.throws(
      () => new Recipe(source, { password: "secret" }),
      /Password-protected/,
    );
    assert.throws(() => new Recipe().encrypt({}), /excludes OpenSSL/);
  });

  it("rejects extension names inherited from Recipe.prototype", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe();
    assert.throws(
      () => recipe.register("toString", function toString() {}),
      /already exists/,
    );
    recipe.endPDF();
  });

  it("uses modifier-safe Recipe links, images, and clipping", async function () {
    var Recipe = await createRecipe();
    var font = new Uint8Array(
      await readFile("tests/TestMaterials/fonts/arial.ttf"),
    );
    var image = new Uint8Array(
      await readFile("tests/TestMaterials/images/png/pnglogo-grr.png"),
    );
    var source = new Recipe({ compress: false })
      .createPage(200, 200)
      .endPage()
      .endPDF();
    var recipe = new Recipe(source, { compress: false });
    recipe.registerFont("instance-font", font);
    await recipe.registerFontAsync("instance-font-async", new Blob([font]));
    Recipe.registerImage("source-image", image, "png");
    var html = recipe.htmlToTextObjects("<b>bold</b><br>text");
    assert.equal(html[0].value, "bold");
    assert.equal(html[0].styles.bold, true);
    assert.equal(html.map((part) => part.value).join(""), "bold\ntext");
    recipe
      .editPage(1)
      .link("https://example.test", 10, 10, 20, 10)
      .image("source-image", 10, 30, { width: 20 })
      .text("this source text is clipped", 10, 60, {
        font: "instance-font",
        textBox: { width: 30, wrap: "clip" },
      })
      .endPage();
    var output = new TextDecoder().decode(recipe.endPDF());
    assert.match(output, /\/URI \(https:\/\/example\.test\)/);
    assert.match(output, /30 [\d.]+ re\r?\nW\r?\nn/);
  });
});
