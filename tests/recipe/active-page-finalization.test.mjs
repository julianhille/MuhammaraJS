// Covers the call sequences from issue #732: endPDF() and appendPage() reached
// with a page still open. Both finish that page, so the document keeps it
// instead of losing it to a writer that cannot finalize around an open
// content stream.
import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { drawnContent, pageContent, pageCount } from "../support/pdf.mjs";
import { mediaBoxes, numberedPdf } from "../support/composition.mjs";

var LONG_PDF = "recipe/compressed.tracemonkey-pldi-09.pdf";

describeEnds("Recipe finalization with an active page", function (end) {
  it("finishes an empty active page on endPDF", function () {
    var recipe = end.newRecipe();
    recipe.createPage(600, 800);

    var bytes = recipe.endPDF();
    writeOutput(end, "active-page-finalization-empty", bytes);
    assert.equal(pageCount(end, bytes), 1);
  });

  it("keeps the active page's content when endPDF finishes it", function () {
    var recipe = end.newRecipe();
    recipe.createPage(600, 800).text("hi", 10, 10, { font: "arial" });

    var bytes = recipe.endPDF();
    writeOutput(end, "active-page-finalization-text", bytes);
    assert.equal(pageCount(end, bytes), 1);
    assert.match(pageContent(end, bytes), /Tj|TJ/);
  });

  it("matches an explicit endPage for page count and content", function () {
    var implicit = end.newRecipe();
    implicit.createPage(600, 800).text("hi", 10, 10, { font: "arial" });
    var explicit = end.newRecipe();
    explicit
      .createPage(600, 800)
      .text("hi", 10, 10, { font: "arial" })
      .endPage();

    var implicitBytes = implicit.endPDF();
    var explicitBytes = explicit.endPDF();
    writeOutput(end, "active-page-finalization-implicit", implicitBytes);
    writeOutput(end, "active-page-finalization-explicit", explicitBytes);
    assert.equal(pageCount(end, implicitBytes), pageCount(end, explicitBytes));
    assert.equal(
      pageContent(end, implicitBytes),
      pageContent(end, explicitBytes),
    );
  });

  it("finishes the active page before appending, keeping both pages in order", function () {
    var recipe = end.newRecipe();
    recipe.createPage(600, 800).text("hi", 10, 10, { font: "arial" });
    recipe.appendPage(end.pdf(LONG_PDF), 1);

    var bytes = recipe.endPDF();
    writeOutput(end, "active-page-finalization-append", bytes);
    // The created page is written before the appended one.
    assert.deepEqual(mediaBoxes(end, bytes), [
      [0, 0, 600, 800],
      [0, 0, 612, 792],
    ]);
  });

  it("leaves the active page open when appendPage rejects its selection", function () {
    var recipe = end.newRecipe();
    recipe.createPage(600, 800).text("hi", 10, 10, { font: "arial" });

    assert.throws(() => recipe.appendPage(end.pdf(LONG_PDF), [0]), RangeError);

    // The page survived the rejection, so drawing continues on it.
    recipe.text("still here", 10, 40, { font: "arial" });
    var bytes = recipe.endPDF();
    writeOutput(end, "active-page-finalization-rejected", bytes);
    assert.equal(pageCount(end, bytes), 1);
    assert.equal(pageContent(end, bytes).match(/Tj|TJ/g).length, 2);
  });

  it("finishes an edited source page on endPDF", function () {
    var source = end.newRecipe().createPage(400, 400).endPage().endPDF();
    var recipe = end.openRecipe(source);
    recipe.editPage(1).text("edited", 10, 50, { font: "arial" });

    var bytes = recipe.endPDF();
    writeOutput(end, "active-page-finalization-edit", bytes);
    assert.equal(pageCount(end, bytes), 1);
    // The source page is empty, so drawn text proves the edit was kept.
    assert.match(drawnContent(end, bytes), /Tj|TJ/);
  });

  it("finishes a page created on a source document before appending", function () {
    var source = end.newRecipe().createPage(400, 400).endPage().endPDF();
    var recipe = end.openRecipe(source);
    recipe.createPage(200, 200).text("added", 10, 10, { font: "arial" });
    recipe.appendPage(end.pdf(LONG_PDF), 1);

    var bytes = recipe.endPDF();
    writeOutput(end, "active-page-finalization-source-append", bytes);
    assert.deepEqual(mediaBoxes(end, bytes), [
      [0, 0, 400, 400],
      [0, 0, 200, 200],
      [0, 0, 612, 792],
    ]);
  });

  it("still reports a page left open while pages are marked for deletion", function () {
    var recipe = end.openRecipe(numberedPdf(end, 2));
    recipe.editPage(1).deletePage(2);

    assert.throws(() => recipe.endPDF(), /Finish the current page/);
    // The guard runs before finalization, so the document still recovers.
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "active-page-finalization-deleted", bytes);
    assert.deepEqual(mediaBoxes(end, bytes), [[0, 0, 101, 201]]);
  });

  it("rejects createPage while a created page is still active", function () {
    var recipe = end.newRecipe();
    recipe.createPage(400, 400).text("first", 20, 20, { font: "arial" });

    assert.throws(() => recipe.createPage(400, 400), {
      name: "Error",
      message: "Finish the current page before creating another page",
    });
    // The rejected call left the first page open, so it still finishes.
    recipe.text("still here", 20, 40, { font: "arial" }).endPage();
    var bytes = recipe.createPage(400, 400).endPage().endPDF();
    writeOutput(end, "active-page-finalization-create", bytes);
    assert.equal(pageCount(end, bytes), 2);
    assert.equal(pageContent(end, bytes).match(/Tj|TJ/g).length, 2);
  });

  it("rejects createPage while an edited page is still active", function () {
    var recipe = end.openRecipe(LONG_PDF);
    recipe.editPage(1);

    assert.throws(() => recipe.createPage(400, 400), {
      name: "Error",
      message: "Finish the current page before creating another page",
    });
    var bytes = recipe.endPage().createPage(400, 400).endPage().endPDF();
    writeOutput(end, "active-page-finalization-create-edit", bytes);
    assert.equal(pageCount(end, bytes), 15);
    assert.deepEqual(mediaBoxes(end, bytes)[14], [0, 0, 400, 400]);
  });

  it("rejects editPage while an edited page is still active", function () {
    var source = end
      .newRecipe()
      .createPage(300, 300)
      .endPage()
      .createPage(300, 300)
      .endPage()
      .endPDF();
    var recipe = end.openRecipe(source);
    recipe.editPage(1).text("x", 20, 20, { font: "arial" });

    assert.throws(() => recipe.editPage(2), {
      name: "Error",
      message: "Finish the current page before editing another page",
    });
    // The rejected call left page 1 open, so it still finishes.
    var bytes = recipe
      .endPage()
      .editPage(2)
      .text("y", 20, 20, { font: "arial" })
      .endPage()
      .endPDF();
    writeOutput(end, "active-page-finalization-edit-edit", bytes);
    assert.equal(pageCount(end, bytes), 2);
    assert.match(drawnContent(end, bytes, 0), /Tj|TJ/);
    assert.match(drawnContent(end, bytes, 1), /Tj|TJ/);
  });

  it("rejects editPage while a created page is still active", function () {
    var recipe = end.openRecipe(LONG_PDF);
    recipe.createPage(400, 400);

    assert.throws(() => recipe.editPage(1), {
      name: "Error",
      message: "Finish the current page before editing another page",
    });
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "active-page-finalization-edit-create", bytes);
    assert.equal(pageCount(end, bytes), 15);
  });

  it("rejects editPage on a new document", function () {
    var recipe = end.newRecipe();
    // Each end in its own words, as it always was.
    assert.throws(() => recipe.editPage(1), {
      name: "Error",
      message:
        end.name === "wasm"
          ? "editPage requires a Recipe constructed from PDF bytes"
          : "editPage requires a Recipe constructed from an existing PDF",
    });
    var bytes = recipe.createPage(600, 800).endPage().endPDF();
    writeOutput(end, "active-page-finalization-edit-new", bytes);
    assert.equal(pageCount(end, bytes), 1);
  });
});
