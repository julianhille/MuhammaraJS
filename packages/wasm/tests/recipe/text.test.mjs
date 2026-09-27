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
});
