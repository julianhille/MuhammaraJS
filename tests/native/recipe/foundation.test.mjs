import assert from "node:assert/strict";
import { describeEnd, fixture } from "../../support/ends.mjs";
import { outputPath } from "../../support/metadata.mjs";

describeEnd("native", "Recipe foundation", function (end) {
  it("returns the callback result from endPDF()", function () {
    var recipe = end.newRecipe().createPage().endPage();
    var callbackBytes;
    var result = recipe.endPDF((bytes) => {
      callbackBytes = bytes;
      return "done";
    });
    assert.equal(result, "done");
    assert.ok(Buffer.isBuffer(callbackBytes));
    // A later call hands the same Buffer to a new callback.
    assert.strictEqual(
      recipe.endPDF((bytes) => bytes),
      callbackBytes,
    );
  });

  it("keeps the instance state of path and Buffer sources", function () {
    var source = fixture("Original.pdf");
    var output = outputPath(end, "foundation-state.pdf");
    var recipe = new end.Recipe(source, output);
    assert.equal(recipe.src, source);
    assert.equal(recipe.output, output);
    assert.equal(recipe.isBufferSrc, false);
    assert.equal(recipe.outStream, undefined);
    assert.equal(recipe.logFile, "muhammara-error.log");
    assert.equal(recipe.filename, "Original.pdf");
    // plain fields, assignable as they always were
    recipe.output = output;
    recipe.metadata = recipe.metadata;
    recipe.endPDF();
    var buffer = Buffer.from("new");
    recipe = new end.Recipe(buffer);
    assert.strictEqual(recipe.src, buffer);
    assert.equal(recipe.output, undefined);
    assert.equal(recipe.isBufferSrc, true);
    var bytes = recipe.createPage(100, 100).endPage().endPDF();
    assert.strictEqual(recipe.outStream.buffer, bytes);
    assert.equal(recipe.metadata.pageCount, 1);
  });
});
