import assert from "node:assert/strict";
import { createRecipe } from "../../index.js";

describe("Recipe graphics state", function () {
  it("rotates subsequent content around a Recipe coordinate", async function () {
    var Recipe = await createRecipe();
    var bytes = new Recipe({ compress: false })
      .createPage(200, 300)
      .rotateContent(90, 30, 40)
      .rectangle(0, 0, 10, 10, { fill: "#000000" })
      .endPage()
      .endPDF();
    var content = new TextDecoder().decode(bytes);
    assert.match(content, /1 0 0 1 30 260 cm/);
    assert.match(content, /0 1 -1 0 0 0 cm/);
  });
});
