// Ports creation behavior from tests/recipe/create.js and createWithBuffer.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getRecipe } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

describe("Recipe create", function () {
  var Recipe;

  before(async function () {
    Recipe = await getRecipe();
  });

  it("provides text dimensions and registered extensions", function () {
    var dimensionsRecipe = new Recipe();
    var textDimensions = dimensionsRecipe.textDimensions("Browser Recipe", {
      font: "arial",
      fontSize: 24,
    });
    assert.ok(textDimensions.width > 0);
    writeOutput("create-text-dimensions", dimensionsRecipe.endPDF());

    var extensionRecipe = new Recipe();
    assert.equal(
      extensionRecipe.register("drawDot", function (x, y) {
        return this.circle(x, y, 2, { fill: "#000000" });
      }),
      extensionRecipe,
    );
    assert.equal(typeof extensionRecipe.drawDot, "function");
    writeOutput(
      "create-extension",
      extensionRecipe.createPage(100, 100).drawDot(50, 50).endPage().endPDF(),
    );

    var namedExtensionRecipe = new Recipe();
    assert.equal(
      namedExtensionRecipe.register(function drawSquare(x, y) {
        return this.rectangle(x, y, 2, 2, { fill: "#000000" });
      }),
      namedExtensionRecipe,
    );
    assert.throws(
      () => namedExtensionRecipe.register("drawSquare", () => {}),
      /already exists/,
    );
    writeOutput(
      "create-named-extension",
      namedExtensionRecipe
        .createPage(100, 100)
        .drawSquare(50, 50)
        .endPage()
        .endPDF(),
    );
  });

  it("chains valid context transitions and rejects unmatched calls", function () {
    var recipe = new Recipe();
    assert.throws(() => recipe.pauseContext(), /No active page/);
    assert.throws(() => recipe.resumeContext(), /No paused page/);
    recipe.createPage().rectangle(10, 10, 20, 20);
    assert.equal(recipe.pauseContext(), recipe);
    assert.throws(() => recipe.pauseContext(), /No active page/);
    assert.equal(recipe.resumeContext(), recipe);
    assert.throws(() => recipe.resumeContext(), /No paused page/);
    recipe.rectangle(40, 40, 20, 20).endPage();
    assert.throws(() => recipe.pauseContext(), /No active page/);
    assert.throws(() => recipe.resumeContext(), /No paused page/);
    writeOutput("create-context-transitions", recipe.endPDF());
  });

  it("tracks named-page metadata, margins, and rotation", function () {
    var recipe = new Recipe().createPage("letter", 90, {
      left: 40,
      right: 20,
      top: 50,
      bottom: 30,
    });
    assert.equal(recipe.pageInfo(1).width, 792);
    assert.equal(recipe.pageInfo(1).height, 612);
    assert.deepEqual(recipe.position, { x: 0, y: 0 });
    recipe.text("margin layout", { font: "arial" });
    // Implicit text starts at the margins and moves the text cursor only;
    // the path position stays where moveTo and lineTo left it.
    assert.deepEqual(recipe.position, { x: 0, y: 0 });
    var [cursorX, cursorY] = recipe.movedown(0, true);
    assert.equal(cursorX, 40);
    assert.equal(cursorY, 50);
    writeOutput("create-margin-layout", recipe.rotate(90).endPage().endPDF());
    assert.equal(recipe.getCurrentPageInfo().rotate, 90);
  });

  it("tracks current-page rotation for named and explicit sizes", function () {
    var named = new Recipe().createPage("letter").rotate(90);
    assert.deepEqual(named.pageInfo(1), {
      pageNumber: 1,
      mediaBox: [0, 0, 612, 792],
      rotate: 90,
      width: 612,
      height: 792,
      layout: "portrait",
      size: [612, 792],
      offsetX: 0,
      offsetY: 0,
    });
    var namedBytes = named.endPage().endPDF();
    writeOutput("create-rotation-named", namedBytes);
    assert.equal(named.read(namedBytes)[1].rotate, 90);

    var explicit = new Recipe().createPage(100, 200).rotate(90);
    assert.equal(explicit.getCurrentPageInfo().rotate, 90);
    assert.equal(explicit.pageInfo(1).width, 100);
    assert.equal(explicit.pageInfo(1).height, 200);
    var explicitBytes = explicit.endPage().endPDF();
    writeOutput("create-rotation-explicit", explicitBytes);
    assert.equal(explicit.read(explicitBytes)[1].rotate, 90);
  });

  it("reports active page geometry", function () {
    var recipe = new Recipe();

    assert.equal(recipe.getCurrentPageInfo(), null);
    recipe.createPage("letter", 90);
    assert.deepEqual(recipe.getCurrentPageInfo(), recipe.pageInfo(1));
    recipe.endPage();
    assert.deepEqual(recipe.getCurrentPageInfo(), recipe.pageInfo(1));
    var bytes = recipe.endPDF();
    writeOutput("create-page-geometry-source", bytes);
    var sourceRecipe = new Recipe(bytes);
    assert.deepEqual(
      sourceRecipe.getCurrentPageInfo(),
      sourceRecipe.pageInfo(1),
    );
    writeOutput("create-page-geometry-reopened", sourceRecipe.endPDF());
  });

  it("rejects rotate() on an edited page", async function () {
    var source = new Uint8Array(
      await readFile("tests/TestMaterials/Original.pdf"),
    );
    var recipe = new Recipe(source).editPage(1);
    assert.throws(
      () => recipe.rotate(90),
      /^Error: rotate\(\) is only available on pages created with createPage\(\)$/,
    );
    var pdf = recipe.endPage().endPDF();
    writeOutput("create-rotate-edited-page", pdf);
    assert.equal(new Recipe(pdf).pageInfo(1).rotate, 0);
  });

  it("validates rotate() and setPageBox() arguments", async function () {
    var { createMuhammaraWasm, PageBox } = await import("../../index.js");
    var muhammara = await createMuhammaraWasm();
    var recipe = new Recipe();
    assert.throws(() => recipe.rotate(90), {
      name: "TypeError",
      message: "rotate requires an active page",
    });
    recipe.createPage("A4");
    assert.throws(() => recipe.rotate(45), {
      name: "RangeError",
      message: "Rotation must be a multiple of 90 degrees",
    });
    assert.throws(() => recipe.rotate(90n), {
      name: "TypeError",
      message: "Rotation is not set to a number",
    });
    assert.throws(
      () => recipe.setPageBox(muhammara.ePDFPageBoxCropBox, 0, 0, 10n, 10),
      { name: "TypeError", message: "setPageBox coordinates must be numbers" },
    );
    var pdf = recipe
      .rotate(180)
      .setPageBox(PageBox.CROP, 10, 20, 300, 400)
      .endPage()
      .endPDF();
    writeOutput("create-rotate-validation", pdf);
    var reader = muhammara.createReader(pdf);
    assert.equal(
      reader.parsePageDictionary(0).queryObject("Rotate").value,
      180,
    );
    reader.end();
  });
});
