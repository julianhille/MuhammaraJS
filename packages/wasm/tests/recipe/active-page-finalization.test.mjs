// Covers the call sequences from issue #732: endPDF() and appendPage() reached
// with a page still open. Both finish that page instead of failing, so the same
// script works here as it does against native Recipe.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

/** Reads a finished document's page count through a disposed reader. */
function pageCount(muhammara, bytes) {
  var reader = muhammara.createReader(bytes);
  try {
    return reader.getPagesCount();
  } finally {
    reader.end();
  }
}

/** Concatenates a page's content streams as latin1 text. */
function pageContent(muhammara, bytes, pageIndex = 0) {
  var reader = muhammara.createReader(bytes);
  try {
    var page = reader.parsePage(pageIndex).getDictionary();
    var contents = reader.queryDictionaryObject(page, "Contents");
    var streams =
      contents.getType() === muhammara.ePDFObjectArray
        ? contents
            .toPDFArray()
            .toJSArray()
            .map((entry) =>
              reader
                .parseNewObject(
                  entry.toPDFIndirectObjectReference().getObjectID(),
                )
                .toPDFStream(),
            )
        : [contents.toPDFStream()];
    return streams
      .map((stream) => {
        var readStream = reader.startReadingFromStream(stream);
        var text = "";
        while (readStream.notEnded()) {
          text += Buffer.from(readStream.read(4096)).toString("latin1");
        }
        return text;
      })
      .join("");
  } finally {
    reader.end();
  }
}

describe("Recipe finalization with an active page", function () {
  it("finishes an empty active page on endPDF", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var recipe = new Recipe();
    recipe.createPage(600, 800);

    var bytes = recipe.endPDF();
    writeOutput("active-page-endPDF-empty", bytes);
    assert.equal(pageCount(muhammara, bytes), 1);
  });

  it("keeps the active page's content when endPDF finishes it", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var recipe = new Recipe();
    recipe.createPage(600, 800).text("hi", 10, 10, { font: "arial" });

    var bytes = recipe.endPDF();
    writeOutput("active-page-endPDF-text", bytes);
    assert.equal(pageCount(muhammara, bytes), 1);
    assert.match(pageContent(muhammara, bytes), /Tj|TJ/);
  });

  it("matches an explicit endPage() for page count and content", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var implicit = new Recipe();
    implicit.createPage(600, 800).text("hi", 10, 10, { font: "arial" });
    var explicit = new Recipe();
    explicit
      .createPage(600, 800)
      .text("hi", 10, 10, { font: "arial" })
      .endPage();

    var implicitBytes = implicit.endPDF();
    var explicitBytes = explicit.endPDF();
    assert.equal(
      pageCount(muhammara, implicitBytes),
      pageCount(muhammara, explicitBytes),
    );
    assert.equal(
      pageContent(muhammara, implicitBytes),
      pageContent(muhammara, explicitBytes),
    );
  });

  it("finishes the active page before appending, keeping both pages in order", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var source = new Recipe().createPage(300, 300).endPage().endPDF();
    Recipe.registerPdf("active-page-source", source);
    try {
      var recipe = new Recipe();
      recipe.createPage(600, 800).text("hi", 10, 10, { font: "arial" });
      recipe.appendPage("active-page-source");

      var bytes = recipe.endPDF();
      writeOutput("active-page-appendPage", bytes);
      assert.equal(pageCount(muhammara, bytes), 2);
      var reader = muhammara.createReader(bytes);
      try {
        assert.deepEqual(
          reader.parsePage(0).getMediaBox(),
          [0, 0, 600, 800],
          "the created page is written before the appended one",
        );
        assert.deepEqual(reader.parsePage(1).getMediaBox(), [0, 0, 300, 300]);
      } finally {
        reader.end();
      }
    } finally {
      Recipe.unregisterPdf("active-page-source");
    }
  });

  it("leaves the active page open when appendPage rejects its selection", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var source = new Recipe().createPage(300, 300).endPage().endPDF();
    Recipe.registerPdf("active-page-rejected", source);
    try {
      var recipe = new Recipe();
      recipe.createPage(600, 800).text("hi", 10, 10, { font: "arial" });
      assert.throws(
        () => recipe.appendPage("active-page-rejected", [0]),
        RangeError,
      );

      // The page survived the rejection, so drawing continues on it.
      recipe.text("still here", 10, 40, { font: "arial" });
      var bytes = recipe.endPDF();
      assert.equal(pageCount(muhammara, bytes), 1);
    } finally {
      Recipe.unregisterPdf("active-page-rejected");
    }
  });

  it("finishes an edited source page on endPDF", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var source = new Recipe().createPage(400, 400).endPage().endPDF();
    var recipe = new Recipe(source);
    recipe.editPage(1).text("edited", 10, 10, { font: "arial" });

    var bytes = recipe.endPDF();
    writeOutput("active-page-endPDF-edit", bytes);
    assert.equal(pageCount(muhammara, bytes), 1);
    // A page modifier writes the edit into a form XObject the page invokes,
    // so a Do operator is what proves the edit reached the output.
    assert.match(pageContent(muhammara, bytes), /\bDo\b/);
  });

  it("finishes a page created on a source document before appending", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var source = new Recipe().createPage(400, 400).endPage().endPDF();
    Recipe.registerPdf("active-page-source-mode", source);
    try {
      var recipe = new Recipe(source);
      recipe.createPage(200, 200).text("added", 10, 10, { font: "arial" });
      recipe.appendPage("active-page-source-mode");

      var bytes = recipe.endPDF();
      writeOutput("active-page-source-mode", bytes);
      assert.equal(pageCount(muhammara, bytes), 3);
    } finally {
      Recipe.unregisterPdf("active-page-source-mode");
    }
  });

  it("still reports a page left open while pages are marked for deletion", async function () {
    var Recipe = await getRecipe();
    var source = new Recipe()
      .createPage(300, 300)
      .endPage()
      .createPage(300, 300)
      .endPage()
      .endPDF();
    var recipe = new Recipe(source);
    recipe.editPage(1).deletePage(2);

    assert.throws(() => recipe.endPDF(), /Finish the current page/);
    // The failed guard runs before finalization, so the document recovers.
    assert.ok(recipe.endPage().endPDF() instanceof Uint8Array);
  });
});
