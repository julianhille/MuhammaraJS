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

  it("contains character spacing and rejects non-finite values", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe({ compress: false }).createPage(200, 200);
    assert.throws(
      () => recipe.text("Invalid", 20, 20, { charSpace: Infinity }),
      /charSpace must be a finite number/,
    );
    assert.throws(
      () => recipe.text("Invalid", 20, 20, { charSpace: NaN }),
      /charSpace must be a finite number/,
    );
    var bytes = recipe
      .text("Spaced", 20, 40, { charSpace: 5 })
      .endPage()
      .endPDF();
    writeOutput("text-charspace", bytes);
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(bytes);
    try {
      var stream = reader.startReadingFromStream(
        reader
          .queryDictionaryObject(reader.parsePageDictionary(0), "Contents")
          .toPDFStream(),
      );
      var chunks = [];
      while (stream.notEnded()) chunks.push(Buffer.from(stream.read(4096)));
      var content = Buffer.concat(chunks).toString("latin1");
      assert.match(
        content,
        /q\s+BT\s+5 Tc\s+ET[\s\S]*?\bTj\s+ET\s+Q/,
        "Recipe character spacing is restored after its text operation",
      );
    } finally {
      reader.end();
      muhammara.disposeAssets();
    }
  });
});
