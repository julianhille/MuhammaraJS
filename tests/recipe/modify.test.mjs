import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { annotations, drawnContent, info } from "../support/pdf.mjs";

/**
 * Add text, shapes and comments to the first two pages of a source PDF.
 * @param {object} recipe - A Recipe opened on the source.
 * @returns {Uint8Array} The edited PDF.
 */
function addSomething(recipe) {
  recipe
    .info({ author: "wahaha" })
    .editPage(1)
    .text("Add some texts to an existing pdf file", 150, 300, {
      font: "arial",
    })
    .circle("center", 100, 60, {
      stroke: "#3b7721",
      fill: "#0e0e0e",
      opacity: 0.4,
    })
    .circle("center", 100, 30, {
      stroke: "#0032FF",
    })
    .rectangle("center", "center", 450, 450, {
      color: [255, 0, 255],
      opacity: 0.2,
    })
    .comment("Add 1st comment annotaion", 200, 300)
    .endPage();
  return recipe
    .editPage(2)
    .comment("Add 2nd comment annotaion", 200, 100)
    .endPage()
    .endPDF();
}

/**
 * The Contents of a page's comment annotations.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} pageIndex - The zero-based page.
 * @returns {string[]} The comment texts.
 */
function comments(end, bytes, pageIndex) {
  return annotations(end, bytes, pageIndex)
    .filter((annot) => annot.Subtype === "Text")
    .map((annot) => annot.Contents);
}

describeEnds("Recipe modify", function (end) {
  it("adds text, shapes and comments to an existing PDF", function () {
    var recipe = end.openRecipe("recipe/test.pdf");
    recipe.editPage(1);
    assert.throws(() => recipe.resumeContext(), /No paused page/);
    assert.equal(recipe.pauseContext(), recipe);
    assert.throws(() => recipe.pauseContext(), /No active page/);
    assert.equal(recipe.resumeContext(), recipe);
    assert.throws(() => recipe.resumeContext(), /No paused page/);
    recipe.endPage();
    var bytes = addSomething(recipe);
    writeOutput(end, "modify-existing", bytes);
    assert.equal(info(end, bytes).Author, "wahaha");
    assert.deepEqual(comments(end, bytes, 0), ["Add 1st comment annotaion"]);
    assert.deepEqual(comments(end, bytes, 1), ["Add 2nd comment annotaion"]);
    // Edits are drawn through forms, where text extraction does not look.
    assert.match(
      drawnContent(end, bytes),
      /\(Add some texts to an existing pdf file\) Tj/,
    );
  });

  it("keeps the annotations a page already has", function () {
    var bytes = addSomething(end.openRecipe("recipe/test2.pdf"));
    writeOutput(end, "modify-existing-with-annots", bytes);
    assert.equal(info(end, bytes).Author, "wahaha");
    var first = comments(end, bytes, 0);
    assert.equal(first.length, 2);
    assert.equal(first.at(-1), "Add 1st comment annotaion");
    assert.deepEqual(comments(end, bytes, 1), ["Add 2nd comment annotaion"]);
  });

  it("marks the page origin in debug mode", function () {
    var recipe = end.openRecipe("Original.pdf");
    recipe.debug = true;
    var bytes = recipe.editPage(1).endPage().endPDF();
    writeOutput(end, "modify-debug", bytes);
    var shown = drawnContent(end, bytes).match(/\([^()]* is HERE\)/g);
    assert.deepEqual(shown, [
      "([0, 0] is HERE)",
      "([0, width/2] is HERE)",
      "([0, height/2] is HERE)",
      "([width/2, 0] is HERE)",
      "([height/2, 0] is HERE)",
    ]);
  });
});
