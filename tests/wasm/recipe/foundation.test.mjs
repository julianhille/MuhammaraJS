import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeEnd, fixture } from "../../support/ends.mjs";

/**
 * Read a font fixture as bytes.
 * @param {string} name - The file name below TestMaterials/fonts.
 * @returns {Uint8Array} The font bytes.
 */
function font(name) {
  return new Uint8Array(readFileSync(fixture(`fonts/${name}`)));
}

describeEnd("wasm", "Recipe foundation", function (end) {
  it("exposes StructureFormat as a frozen static", function () {
    assert.ok(Object.isFrozen(end.Recipe.StructureFormat));
  });

  it("returns the bytes from endPDF() with a callback", function () {
    var recipe = end.newRecipe().createPage().endPage();
    var callbackBytes;
    var bytes = recipe.endPDF((result) => {
      callbackBytes = result;
    });
    assert.ok(bytes instanceof Uint8Array);
    assert.strictEqual(callbackBytes, bytes);
  });

  it("constructs from options or bytes and rejects paths", function () {
    var source = end.newRecipe().createPage().endPage().endPDF();
    assert.equal(new end.Recipe().isNewPDF, true);
    assert.equal(new end.Recipe({ compress: false }).isNewPDF, true);
    assert.equal(new end.Recipe(source).isNewPDF, false);
    assert.throws(() => new end.Recipe(source, 5), {
      name: "TypeError",
      message: "Recipe options must be an object",
    });
    assert.throws(() => new end.Recipe("input.pdf"), {
      name: "TypeError",
      message: "Recipe options must be an object",
    });
    assert.throws(
      () => end.Recipe.registerPdf("path", "input.pdf"),
      /Uint8Array/,
    );
  });

  it("rejects missing pages and unregistered PDFs in the words of 1.x", function () {
    var source = end.newRecipe().createPage().endPage().endPDF();
    [2, 0, -1, 1.5].forEach((pageNumber) =>
      assert.throws(() => new end.Recipe(source).editPage(pageNumber), {
        name: "RangeError",
        message: "pageNumber must identify an existing page",
      }),
    );
    var recipe = end.newRecipe().createPage();
    assert.throws(() => recipe.appendPage("nope"), {
      name: "Error",
      message: "Unknown PDF: nope",
    });
    assert.throws(() => recipe.overlay("nope"), {
      name: "Error",
      message: "Unknown PDF: nope",
    });
    recipe.endPage().endPDF();
  });

  it("requires the Async API for a Blob and reads it without entering source mode", async function () {
    var source = end.newRecipe().createPage().endPage().endPDF();
    var recipe = end.newRecipe();
    assert.throws(() => recipe.read(new Blob([source])), /Async API/);
    var metadata = await recipe.readAsync(new Blob([source]));
    assert.equal(metadata.pages, 1);
    assert.throws(() => recipe.editPage(1), /constructed from PDF bytes/);
    recipe.createPage().endPage().endPDF();
  });

  it("registers byte fonts by family and selects their requested style", function () {
    var arial = font("arial.ttf");
    end.Recipe.registerFont("FoundationArial", arial, "regular");
    end.Recipe.registerFont("FoundationArial", arial, "bold");
    var recipe = end.newRecipe();
    assert.ok(
      recipe.textDimensions("styled", { font: "foundationarial", bold: true })
        .width > 0,
    );
    recipe.endPDF();
  });

  it("measures a font registered again under the same name anew", function () {
    end.Recipe.registerFont("foundation-again", font("arial.ttf"));
    var recipe = end.newRecipe();
    var options = { font: "foundation-again", fontSize: 12 };
    var first = recipe.textDimensions("Hello world", options).width;
    end.Recipe.registerFont("foundation-again", font("Couri.ttf"));
    // Measurements are kept by the font they were taken in, not its name.
    assert.notEqual(recipe.textDimensions("Hello world", options).width, first);
    recipe.endPDF();
  });

  it("registers fonts, images and PDFs from Blobs", async function () {
    var source = end.newRecipe().createPage().endPage().endPDF();
    var arial = font("arial.ttf");
    var logo = new Uint8Array(
      readFileSync(fixture("images/png/pnglogo-grr.png")),
    );
    await end.Recipe.registerFontAsync(
      "foundation-async-font",
      new Blob([arial]),
      "italic",
    );
    await end.Recipe.registerImageAsync(
      "foundation-async-image",
      new Blob([logo]),
      "png",
    );
    await end.Recipe.registerPdfAsync(
      "foundation-async-pdf",
      new Blob([source]),
    );
    var recipe = end.newRecipe();
    assert.equal(
      await recipe.registerFontAsync(
        "foundation-instance-async",
        new Blob([arial]),
      ),
      recipe,
    );
    var bytes = recipe
      .createPage(200, 200)
      .text("async", 10, 10, { font: "foundation-instance-async" })
      .text("italic", 10, 40, { font: "foundation-async-font", italic: true })
      .image("foundation-async-image", 10, 80, { width: 20 })
      .image("foundation-async-pdf", 50, 80, { width: 20 })
      .endPage()
      .endPDF();
    assert.ok(bytes.length > 0);
    assert.equal(new end.Recipe().encrypt({}).constructor, end.Recipe);
    end.Recipe.unregisterPdf("foundation-async-pdf");
    end.Recipe.unregisterImage("foundation-async-image");
  });

  it("has no metadata for a new PDF", function () {
    var recipe = new end.Recipe();
    assert.equal(recipe.metadata, undefined);
    var source = recipe.createPage(100, 100).endPage().endPDF();
    assert.equal(recipe.metadata, undefined);
    recipe = new end.Recipe(source);
    assert.equal(recipe.metadata.pages, 1);
    assert.equal(recipe.metadata[1].width, 100);
    // assignable, as it was before it became a getter
    recipe.metadata = { pages: 2 };
    assert.deepEqual(recipe.metadata, { pages: 2 });
    recipe.endPDF();
  });

  // Wasm has no finalizers: a writer nobody ends keeps its memory.
  it("releases the writer of a failed endPDF()", function () {
    var protectedSource = end.openRecipe("PDFWithPassword.PDF", {
      password: "user",
    });
    assert.throws(() => protectedSource.endPDF(), /password-protected/);
    assert.throws(
      () => protectedSource.writer.getDocumentContext(),
      /PDF writer has ended/,
    );
    // the insert pass creates a writer of its own
    var platform = end.Recipe.prototype.platform;
    var newWriter = platform.newWriter;
    var writers = [];
    platform.newWriter = function (...args) {
      var output = newWriter.apply(this, args);
      writers.push(output.writer);
      return output;
    };
    try {
      var inserting = end
        .newRecipe()
        .createPage(100, 100)
        .endPage()
        .insertPage(1, "nope", 1);
      assert.throws(() => inserting.endPDF(), /Unknown PDF: nope/);
    } finally {
      platform.newWriter = newWriter;
    }
    assert.equal(writers.length, 2);
    writers.forEach((writer) =>
      assert.throws(() => writer.getDocumentContext(), /PDF writer has ended/),
    );
  });

  it("releases the writer of a failed constructor", function () {
    var platform = end.Recipe.prototype.platform;
    var modifyWriter = platform.modifyWriter;
    var writers = [];
    platform.modifyWriter = function (...args) {
      var output = modifyWriter.apply(this, args);
      writers.push(output.writer);
      return output;
    };
    try {
      // the info options are applied after the writer exists
      assert.throws(() =>
        end.openRecipe("recipe/test2.pdf", { title: Object.create(null) }),
      );
    } finally {
      platform.modifyWriter = modifyWriter;
    }
    assert.equal(writers.length, 1);
    assert.throws(
      () => writers[0].getDocumentContext(),
      /PDF writer has ended/,
    );
  });

  it("cannot end the PDF after dispose()", function () {
    var recipe = end.newRecipe().createPage(100, 100).endPage();
    recipe.dispose();
    // dispose() releases the writer
    assert.throws(
      () => recipe.writer.getDocumentContext(),
      /PDF writer has ended/,
    );
    assert.throws(() => recipe.endPDF(), {
      message: "Cannot end the PDF after disposal",
    });
    assert.throws(() => recipe.split(), {
      message: "Cannot end the PDF after disposal",
    });
    // an ended Recipe keeps its bytes
    var ended = end.newRecipe().createPage(100, 100).endPage();
    var bytes = ended.endPDF();
    ended.dispose();
    assert.strictEqual(ended.endPDF(), bytes);
  });
});
