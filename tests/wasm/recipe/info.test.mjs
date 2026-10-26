import assert from "node:assert/strict";
import { describeEnd, writeOutput } from "../../support/ends.mjs";
import { pageCount } from "../../support/pdf.mjs";

describeEnd("wasm", "Recipe info", function (end) {
  it("exposes permission bits on the class", function () {
    assert.equal(end.Recipe.permission("print, copy"), 20);
    assert.equal(end.Recipe.permission(), 4);
  });

  it("splits and summarizes a finished PDF in memory", function () {
    var name = end.pdf("recipe/test2.pdf");
    var recipe = end
      .newRecipe({ compress: false })
      .info({ title: "metadata" })
      .appendPage(name, 1)
      .createPage(100, 100)
      .endPage()
      .insertPage(0, name, 2);
    var parts = recipe.split("part");
    assert.deepEqual(
      parts.map((part) => part.name),
      ["part-1.pdf", "part-2.pdf", "part-3.pdf"],
    );
    parts.forEach((part, index) => {
      writeOutput(end, `info-split-${index + 1}`, part.bytes);
      assert.equal(pageCount(end, part.bytes), 1);
    });
    var structure = recipe.structure(end.Recipe.StructureFormat.JSON);
    assert.equal(structure.pages, 3);
    assert.equal(structure.encrypted, false);
    assert.ok(structure.objects > 0);
    assert.match(recipe.structure(), /^Info\nRoot\nSize: \d+\nPages: 3$/);
  });

  it("reports the pages of a PDF that encrypt() protects", function () {
    var structure = end
      .newRecipe()
      .createPage(100, 100)
      .endPage()
      .encrypt({ userPassword: "u" })
      .structure(end.Recipe.StructureFormat.JSON);
    assert.equal(structure.pages, 1);
    assert.equal(structure.encrypted, true);
  });

  it("reports the structure of a PDF without /Info", function () {
    assert.match(end.openRecipe("FontDifferences.pdf").structure(), /^Root$/m);
  });
});
