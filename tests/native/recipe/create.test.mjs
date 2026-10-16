import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeEnd, fixture } from "../../support/ends.mjs";
import { pageCount } from "../../support/pdf.mjs";

var OUTPUT = fileURLToPath(new URL("../../output/native", import.meta.url));

/**
 * A fresh output path in the native output folder.
 * @param {string} name - The file name without extension.
 * @returns {string} The path, with no file at it yet.
 */
function outputPath(name) {
  mkdirSync(OUTPUT, { recursive: true });
  var file = path.join(OUTPUT, `${name}.pdf`);
  rmSync(file, { force: true });
  return file;
}

describeEnd("native", "Recipe create", function (end) {
  it("writes a new PDF to its output path and calls back without an argument", function () {
    var output = outputPath("create-new-path");
    var args;
    new end.Recipe("new", output)
      .createPage(100, 100)
      .endPage()
      .endPDF((...given) => {
        args = given;
      });
    assert.deepEqual(args, [undefined]);
    assert.equal(pageCount(end, readFileSync(output)), 1);
  });

  it("matches the new source case-insensitively, as a string or Buffer", function () {
    assert.equal(end.Recipe.Source.NEW, "new");
    var output = outputPath("create-new-upper-case");
    new end.Recipe("NEW", output).createPage(100, 100).endPage().endPDF();
    assert.equal(pageCount(end, readFileSync(output)), 1);
    var bytes = new end.Recipe(Buffer.from("new"))
      .createPage(100, 100)
      .endPage()
      .endPDF();
    assert.ok(Buffer.isBuffer(bytes));
    assert.equal(pageCount(end, bytes), 1);
  });

  it("edits a path source into its output path and reopens it", function () {
    var output = outputPath("create-path-source");
    var source = fixture("Original.pdf");
    var before = readFileSync(source);
    var recipe = new end.Recipe(source, output);
    // Before any page is opened, the current page is the last one.
    var pages = recipe.read().pages;
    assert.deepEqual(recipe.getCurrentPageInfo(), recipe.pageInfo(pages));
    recipe.editPage(1).endPage().endPDF();
    assert.ok(existsSync(output));
    assert.deepEqual(readFileSync(source), before);
    var reopened = new end.Recipe(output, outputPath("create-path-reopened"));
    assert.deepEqual(reopened.getCurrentPageInfo(), reopened.pageInfo(pages));
    reopened.endPDF();
  });
});
