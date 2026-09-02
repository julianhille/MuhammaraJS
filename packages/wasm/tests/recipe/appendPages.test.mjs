// Ports byte-backed append and split behavior from tests/recipe/appendPages.js and split.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";

describe("Recipe appendPages", function () {
  it("inspects, appends, selects, and splits registered PDFs", async function () {
    var Recipe = await getRecipe();
    var source = new Recipe().createPage(595, 842).endPage().endPDF();
    Recipe.registerPdf("source", source);
    var metadata = Recipe.inspectPdf("source");
    assert.equal(metadata.pages, 1);
    assert.equal(metadata[1].width, 595);
    assert.equal(metadata[1].height, 842);

    var appended = new Recipe().appendPage("source").endPDF();
    assert.match(new TextDecoder().decode(appended), /%%EOF/);
    var selected = new Recipe().appendPage("source", 1).endPDF();
    assert.match(new TextDecoder().decode(selected), /%%EOF/);
    var split = Recipe.splitPdf("source", "split");
    assert.equal(split.length, 1);
    assert.equal(split[0].name, "split-1.pdf");
    assert.match(new TextDecoder().decode(split[0].bytes), /%%EOF/);
  });

  it("does not claim to retain annotations while appending core-copied pages", async function () {
    var Recipe = await getRecipe();
    var source = new Recipe({ compress: false })
      .createPage(100, 100)
      .comment("source annotation", 10, 10, { width: 20, height: 20 })
      .endPage()
      .endPDF();
    assert.match(new TextDecoder().decode(source), /\/Annots/);
    Recipe.registerPdf("annotated-source", source);
    var appended = new Recipe({ compress: false })
      .appendPage("annotated-source")
      .endPDF();
    assert.doesNotMatch(new TextDecoder().decode(appended), /\/Annots/);
  });

  it("appends registered pages after reading byte source PDFs", async function () {
    var Recipe = await getRecipe();
    var source = new Recipe()
      .createPage(100, 100)
      .endPage()
      .createPage(200, 200)
      .endPage()
      .endPDF();
    var appended = new Recipe().createPage(300, 300).endPage().endPDF();
    Recipe.registerPdf("source-mode-append", appended);
    var recipe = new Recipe(source).appendPage("source-mode-append");
    assert.deepEqual(recipe.pageInfo(3).mediaBox, [0, 0, 300, 300]);
    var bytes = recipe.endPDF();
    assert.match(new TextDecoder().decode(bytes), /%%EOF/);
    assert.equal(Recipe.inspectPdf("source-mode-append").pages, 1);
    var reader = (await createMuhammaraWasm()).createReader(bytes);
    assert.equal(reader.getPagesCount(), 3);
    reader.end();
  });
});
