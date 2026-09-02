// Ports annotation behavior from tests/recipe/annotation-*.js.
import assert from "node:assert/strict";
import { getRecipe } from "./recipe.mjs";

describe("Recipe annotation", function () {
  it("writes links, comments, and square annotations", async function () {
    var Recipe = await getRecipe();
    var pdf = new Recipe()
      .createPage(595, 842)
      .link("https://example.com", 50, 300, 160, 24)
      .comment("A browser comment", 250, 300, { title: "Muhammara" })
      .annot(350, 300, "Square", { width: 60, height: 30, text: "A square" })
      .endPage()
      .endPDF();
    var output = new TextDecoder().decode(pdf);
    assert.match(output, /A browser comment/);
    assert.match(output, /\/URI \(https:\/\/example.com\)/);
    assert.match(output, /\/Subtype \/Square/);
  });
});
