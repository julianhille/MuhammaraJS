// Ports text and decoration behavior from tests/recipe/text.js and text-highlight-descenders.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

describe("Recipe text", function () {
  it("writes decorated text with descender-aware highlights", async function () {
    var Recipe = await getRecipe();
    var pdf = new Recipe()
      .createPage(595, 842)
      .text("Browser Recipe", 50, 300, {
        font: "arial",
        fontSize: 24,
        highlight: { color: "#fde68a" },
        underline: true,
        strikeOut: true,
      })
      .text("gypqj descenders", 50, 340, {
        font: "arial",
        fontSize: 30,
        highlight: { color: "#bbf7d0" },
      })
      .endPage()
      .endPDF();
    writeOutput("text-decorated-highlights", pdf);
    var output = new TextDecoder().decode(pdf);
    assert.match(output, /\/Subtype \/Highlight/);
    assert.match(output, /\/QuadPoints/);
  });

  it("keeps hilited text on edited pages", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var source = new Recipe().createPage(200, 200).endPage().endPDF();
    writeOutput("text-hilite-edit-source", source);
    // The hilite rectangle is drawn before the text on an edited page; the
    // text must still reach the page.
    var bytes = new Recipe(source, { compress: false })
      .editPage(1)
      .text("Hilited", 10, 10, { hilite: true })
      .endPage()
      .endPDF();
    writeOutput("hilite-edit", bytes);
    var reader = muhammara.createReader(bytes);
    var textObjects = 0;
    for (var id = 1; id < reader.getXrefSize(); id++) {
      var object = reader.parseNewObject(id);
      if (!object || object.getType() !== muhammara.ePDFObjectStream) continue;
      var dictionary = object.toPDFStream().getDictionary();
      if (
        !dictionary.exists("Subtype") ||
        dictionary.queryObject("Subtype").value !== "Form"
      ) {
        continue;
      }
      var input = reader.startReadingFromStream(object.toPDFStream());
      var chunks = [];
      while (input.notEnded()) chunks.push(...input.read(4096));
      textObjects += (
        new TextDecoder("latin1")
          .decode(new Uint8Array(chunks))
          .match(/\bBT\b/g) || []
      ).length;
    }
    reader.end();
    assert.equal(textObjects, 1);
  });

  it("starts text without coordinates at the margins of a new page", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var recipe = new Recipe()
      .createPage(400, 400)
      .text("first", 20, 20, { flow: true, size: 30 })
      .endPage()
      .createPage(400, 400);
    // Before any text, movedown() starts from the page origin, as in native.
    assert.deepEqual(recipe.movedown(0, true), [0, 0]);
    var bytes = recipe
      .text("second", { flow: true })
      .text("", { flow: false })
      .endPage()
      .endPDF();
    writeOutput("text-new-page-origin", bytes);
    var reader = muhammara.createReader(bytes);
    var [second] = reader.extractPageText(1);
    reader.end();
    assert.equal(second.content, "second");
    assert.equal(Math.round(second.textMatrix[4]), 72);
    // Flow options from the previous page do not carry over.
    assert.equal(second.fontSize, 14);
  });

  it("starts text without coordinates at the margins of an edited page", async function () {
    var Recipe = await getRecipe();
    var source = new Recipe()
      .createPage(400, 400)
      .endPage()
      .createPage(400, 400)
      .endPage()
      .endPDF();
    writeOutput("text-edit-origin-source", source);
    var recipe = new Recipe(source)
      .editPage(1)
      .text("first", 20, 20)
      .endPage()
      .editPage(2);
    assert.deepEqual(recipe.movedown(0, true), [72, 72]);
    recipe.text("second", { flow: false });
    assert.equal(recipe.movedown(0, true)[0], 72);
    writeOutput("text-edit-origin", recipe.endPage().endPDF());
  });

  it("lays out a long line without a text box in linear time", async function () {
    this.timeout(10000);
    var Recipe = await getRecipe();
    var pdf = new Recipe()
      .createPage("A4")
      .text("word ".repeat(600), 10, 10, { size: 8 })
      .endPage()
      .endPDF();
    writeOutput("text-long-line", pdf);
    assert.ok(pdf.length > 0);
  });

  it("ends ellipsized text with the ellipsis glyph", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var bytes = new Recipe({ compress: false })
      .createPage(220, 120)
      .text("alpha bravo charlie", 10, 10, {
        font: "arial",
        size: 12,
        textBox: { width: 70, wrap: "ellipsis" },
      })
      .endPage()
      .endPDF();
    writeOutput("text-ellipsis", bytes);
    var reader = muhammara.createReader(bytes);
    var stream = reader.startReadingFromStream(
      reader
        .queryDictionaryObject(reader.parsePageDictionary(0), "Contents")
        .toPDFStream(),
    );
    var chunks = [];
    while (stream.notEnded()) chunks.push(...stream.read(4096));
    reader.end();
    var content = new TextDecoder("latin1").decode(new Uint8Array(chunks));
    // U+2026 is WinAnsi byte 0x85, written as the octal escape \205.
    assert.match(content, /\(alpha brav\\205\) Tj/);
    assert.doesNotMatch(content, /\.\.\.\) Tj/);
  });

  it("rejects a miterLimit below 1 before drawing", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var error = {
      name: "RangeError",
      message: "miterLimit must be a number of at least 1",
    };
    var recipe = new Recipe().createPage(200, 200);
    assert.throws(
      () => recipe.text("alpha", 20, 20, { font: "arial", miterLimit: 0 }),
      error,
    );
    recipe.text("bravo", 20, 20, { flow: true });
    assert.throws(() => recipe.text("charlie", { miterLimit: 0.5 }), error);
    assert.throws(() => recipe.text("delta", 20, 60, { miterLimit: 0 }), error);
    recipe.text("", { flow: false }).text("echo", 20, 100, { miterLimit: 1 });
    var bytes = recipe.endPage().endPDF();
    writeOutput("text-miter-limit", bytes);
    var reader = muhammara.createReader(bytes);
    var runs = reader.extractPageText(0).map((run) => run.content);
    reader.end();
    assert.deepEqual(runs, ["bravo", "echo"]);
  });
});
