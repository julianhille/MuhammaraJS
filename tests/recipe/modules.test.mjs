// Behaviour the former Wasm module tests checked through injected internals
// (info, text measuring, composition, permissions), asserted here on the
// produced PDF and on return values.
import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { drawnContent, info, pageCount, withReader } from "../support/pdf.mjs";

describeEnds("Recipe module boundaries", function (end) {
  it("writes metadata and reads back a copy of it", function () {
    var recipe = end.newRecipe();
    assert.strictEqual(recipe.info({ keywords: ["one", "two"] }), recipe);
    var values = recipe.info();
    assert.equal(values.keywords, "one, two");
    values.keywords = "changed";
    assert.equal(recipe.info().keywords, "one, two");
    var bytes = recipe.createPage(100, 100).endPage().endPDF();
    writeOutput(end, "modules-info", bytes);
    assert.equal(info(end, bytes).Keywords, "one, two");
  });

  it("measures character spacing into the width, once per call", function () {
    var recipe = end.newRecipe().createPage(100, 100);
    var plain = recipe.textDimensions("abc", { font: "arial", size: 10 });
    var spaced = { font: "arial", size: 10, charSpace: 2 };
    var first = recipe.textDimensions("abc", spaced);
    // The spacing added to one result does not reach the next.
    var second = recipe.textDimensions("abc", spaced);
    recipe.endPage().endPDF();
    assert.deepEqual(second, first);
    assert.ok(first.xMax > plain.xMax, "the spacing extends the text");
    assert.equal(
      first.width - plain.width,
      first.xMax - plain.xMax,
      "width and xMax grow by the same spacing",
    );
  });

  it("clamps an appended page beyond the source to its last page", function () {
    var bytes = end
      .newRecipe()
      .appendPage(end.pdf("recipe/test2.pdf"), 9)
      .endPDF();
    writeOutput(end, "modules-append-clamped", bytes);
    assert.equal(pageCount(end, bytes), 1);
    assert.deepEqual(
      withReader(end, bytes, (reader) =>
        Array.from(reader.parsePage(0).getMediaBox()),
      ),
      [0, 0, 842, 595],
    );
  });

  it("scales an overlay page to the page width", function () {
    var bytes = end
      .newRecipe()
      .createPage(421, 600)
      .overlay(end.pdf("recipe/test2.pdf"), {
        page: 2,
        fitWidth: true,
        keepAspectRatio: true,
      })
      .endPage()
      .endPDF();
    writeOutput(end, "modules-overlay-fit-width", bytes);
    // Page 2 is 842 x 595: half its size fills the width, top-aligned.
    assert.match(drawnContent(end, bytes), /\b0\.5 0 0 0\.5 0 302\.5 cm\b/);
  });

  it("parses permission names independently of a document", function () {
    var recipe = end.newRecipe();
    assert.equal(recipe.permission("print, copy"), 20);
    assert.throws(() => recipe.permission("unknown"), {
      message: "Unknown user access permission (unknown)",
    });
  });
});
