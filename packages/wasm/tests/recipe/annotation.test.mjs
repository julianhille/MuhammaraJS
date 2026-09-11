// Ports annotation behavior from tests/recipe/annotation-*.js.
import assert from "node:assert/strict";
import { getRecipe } from "./recipe.mjs";

describe("Recipe annotation", function () {
  it("writes links, comments, and square annotations", async function () {
    var Recipe = await getRecipe();
    var pdf = new Recipe()
      .createPage(595, 842)
      .link("https://example.com", 50, 300, 160, 24)
      .text("Linked text", 50, 250, { link: "https://text.example.com" })
      .text('<a href="https://html.example.com">HTML link</a>', 180, 250, {
        html: true,
      })
      .image("logo", 50, 275, {
        width: 40,
        height: 40,
        keepAspectRatio: false,
        align: "center center",
        link: "https://image.example.com",
      })
      .rectangle(110, 300, 100, 24, {
        fill: "#dbeafe",
        link: "https://shape.example.com",
      })
      .rectangle(250, 100, 40, 40, {
        fill: "#dbeafe",
        useGivenCoords: true,
        link: "https://pdf-coordinates.example.com",
      })
      .comment("A browser comment", 250, 300, { title: "Muhammara" })
      .annot(350, 300, "Square", { width: 60, height: 30, text: "A square" })
      .endPage()
      .endPDF();
    var output = new TextDecoder().decode(pdf);
    assert.match(output, /A browser comment/);
    assert.match(output, /\/URI \(https:\/\/example.com\)/);
    assert.match(output, /\/Rect \[\s*50 518 210 542\s*\]/);
    assert.match(output, /\/Subtype \/Square/);
    assert.match(output, /\/URI \(https:\/\/text\.example\.com\)/);
    assert.match(output, /\/URI \(https:\/\/html\.example\.com\)/);
    assert.match(output, /\/URI \(https:\/\/image\.example\.com\)/);
    assert.match(output, /\/URI \(https:\/\/shape\.example\.com\)/);
    assert.match(output, /\/URI \(https:\/\/pdf-coordinates\.example\.com\)/);
    assert.match(output, /\/Rect \[\s*30 547 70 587\s*\]/);
    assert.match(output, /\/Rect \[\s*250 100 290 140\s*\]/);
  });
});
