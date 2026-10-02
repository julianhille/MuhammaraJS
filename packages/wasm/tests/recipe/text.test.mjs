// Ports text and decoration behavior from tests/recipe/text.js and text-highlight-descenders.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

  it("ends right-aligned text at the padded right edge", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    muhammara.registerFont(
      "arial",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
    );
    var pdf = new Recipe()
      .createPage(400, 400)
      .text("hello world", 20, 20, {
        font: "arial",
        size: 12,
        textBox: { width: 200, textAlign: "right", padding: [0, 10, 0, 30] },
      })
      .text("hello world", 20, 60, {
        font: "arial",
        size: 12,
        textBox: { width: 200, textAlign: "center" },
      })
      .endPage()
      .endPDF();
    writeOutput("text-right-padding", pdf);
    var reader = muhammara.createReader(pdf);
    var [rightRun, centerRun] = reader.extractPageText(0);
    reader.end();
    var font = muhammara.createWriter().getFontForBytes("arial");
    var glyphsEnd = font.calculateTextDimensions("hello world", 12).xMax;
    var right = rightRun.textMatrix[4] + glyphsEnd;
    assert.ok(Math.abs(right - 210) < 0.5, String(right));
    // Centered between the text's start and where its glyphs end.
    var center = centerRun.textMatrix[4] + glyphsEnd / 2;
    assert.ok(Math.abs(center - 120) < 0.5, String(center));
  });

  it("drops the leading spaces of a justified line", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var firstWords = ["   ", ""].map((prefix) => {
      var pdf = new Recipe()
        .createPage(400, 400)
        .text(prefix + "leading spaces here and more words to wrap", 20, 20, {
          font: "arial",
          size: 12,
          textBox: { width: 200, textAlign: "justify" },
        })
        .endPage()
        .endPDF();
      var reader = muhammara.createReader(pdf);
      var runs = reader.extractPageText(0);
      reader.end();
      return { text: runs[0].text, x: runs[0].textMatrix[4] };
    });
    assert.deepEqual(firstWords[0], firstWords[1]);
  });

  it("starts a new line at every mandatory line break", async function () {
    var Recipe = await getRecipe();
    var pdf = new Recipe()
      .createPage(400, 400)
      .text("one\ntwo\r\nthree\rfour\u2028five\u2029six", 20, 20, {
        textBox: { width: 300 },
      })
      .endPage()
      .endPDF();
    writeOutput("text-line-breaks", pdf);
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(pdf);
    var lines = reader.extractPageText(0).map((element) => element.text);
    reader.end();
    assert.deepEqual(lines, ["one", "two", "three", "four", "five", "six"]);
  });
});
