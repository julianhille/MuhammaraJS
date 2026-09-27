// Byte-first port of tests/FailedLoadRecovery.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";
import { getRecipe } from "../recipe/recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

var junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

// Each load fails; the writer must still finish the PDF.
var failedLoads = {
  "a JPG image that is not a JPG": (writer) =>
    writer.createImageXObjectFromJPGBytes("failed-load.jpg"),
  "a JPG form that is not a JPG": (writer) =>
    writer.createFormXObjectFromJPGBytes("failed-load.jpg"),
  "a PNG form that is not a PNG": (writer) =>
    writer.createFormXObjectFromPNGBytes("failed-load.png"),
  "a TIFF form that is not a TIFF": (writer) =>
    writer.createFormXObjectFromTIFFBytes(junk),
  "a font that is not a font": (writer) =>
    writer.getFontForBytes("failed-load-font"),
};

describe("Failed load recovery", function () {
  var muhammara;

  before(async function () {
    muhammara = await createMuhammaraWasm();
    muhammara.registerImage("failed-load.jpg", junk, "jpeg");
    muhammara.registerImage("failed-load.png", junk, "png");
    muhammara.registerFont("failed-load-font", junk);
  });

  after(function () {
    muhammara.unregisterImage("failed-load.jpg");
    muhammara.unregisterImage("failed-load.png");
    muhammara.unregisterFont("failed-load-font");
  });

  Object.entries(failedLoads).forEach(([name, load]) => {
    it(`ends the PDF after ${name}`, function () {
      var writer = muhammara.createWriter();

      assert.throws(() => load(writer));
      // Loading the same input again fails the same way.
      assert.throws(() => load(writer));
      writer.writePage(writer.createPage(0, 0, 100, 100));
      var bytes = writer.end();
      writeOutput(`FailedLoadRecovery-${name.replace(/\W+/g, "-")}`, bytes);

      var reader = muhammara.createReader(bytes);
      assert.equal(reader.getPagesCount(), 1);
      reader.end();
    });
  });

  it("rejects an unreadable Recipe image and keeps the rest", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe().createPage(100, 100);
    try {
      assert.throws(() => recipe.image(junk, 10, 10), /Unknown image/);
      var bytes = recipe.text("kept", 10, 50).endPage().endPDF();
      writeOutput("FailedLoadRecovery-recipe-image", bytes);
      var reader = muhammara.createReader(bytes);
      assert.equal(reader.getPagesCount(), 1);
      reader.end();
    } finally {
      recipe.dispose();
    }
  });
});
