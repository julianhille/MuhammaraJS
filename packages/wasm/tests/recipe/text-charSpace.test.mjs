import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { charSpacing } from "../../lib/recipe/text.helper.js";
import { writeOutput } from "../testOutput.mjs";
import { getRecipe } from "./recipe.mjs";

var lorem =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
  "Etiam in suscipit purus. Vestibulum ante ipsum primis in faucibus orci luctus " +
  "et ultrices posuere cubilia Curae; Vivamus nec hendrerit felis. Morbi aliquam " +
  "facilisis risus eu lacinia. Sed eu leo in turpis fringilla hendrerit.";

/**
 * Draws one row of three lorem boxes with charSpace 0, 1, and 2.
 * @param {object} recipe Recipe with an open page.
 * @param {number} x Left edge of the row.
 * @param {number} y Top edge of the row.
 * @param {number} w Box width.
 * @param {string} textAlign Box text alignment.
 */
function spacingRow(recipe, x, y, w, textAlign) {
  ["red", "blue", "green"].forEach(function (color, charSpace) {
    recipe.text(lorem, x + (w + 5) * charSpace, y, {
      charSpace,
      textBox: { width: w, textAlign, style: { width: 0.5, color } },
    });
  });
}

describe("Recipe character spacing", function () {
  it("counts spacing between retained Unicode characters", function () {
    assert.equal(charSpacing(" ab", 2), 4);
    assert.equal(charSpacing("ab ", 2), 4);
    assert.equal(charSpacing("a b", 2), 4);
    assert.equal(charSpacing(" ab ", 2), 6);
    assert.equal(charSpacing(" ab ", 2), 6);
    assert.equal(charSpacing("\u{1f600}", 2), 0);
    assert.equal(charSpacing("A\u{1f600}B", 2), 4);
  });

  it("lays out text boxes with character spacing", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe().createPage("letter");
    var x = 20;
    var w = 180;

    var boundaryPlain = recipe.textDimensions(" ab ");
    var boundarySpaced = recipe.textDimensions(" ab ", { charSpace: 2 });
    var unicodePlain = recipe.textDimensions("A\u{1f600}B");
    var unicodeSpaced = recipe.textDimensions("A\u{1f600}B", {
      charSpace: 2,
    });
    assert.equal(boundarySpaced.xMax, boundaryPlain.xMax + 6);
    assert.equal(unicodeSpaced.xMax, unicodePlain.xMax + 4);

    recipe
      .text("charSpace: 0", x + 40, 20, { color: "red" })
      .text("charSpace: 1", x + 45 + w, 20, { color: "blue" })
      .text("charSpace: 2", x + 50 + w * 2, 20, { color: "green" });
    spacingRow(recipe, x, 40, w, "left");
    recipe.text('textAlign: "justify"', x, 260, { color: "#00" });
    spacingRow(recipe, x, 280, w, "justify");
    recipe.text('textAlign: "center"', x, 500, { color: "#00" });
    spacingRow(recipe, x, 520, w, "center");

    writeOutput("text-charSpace", recipe.endPage().endPDF());
    recipe.dispose();
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
    writeOutput("text-charSpace-restored", bytes);
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
