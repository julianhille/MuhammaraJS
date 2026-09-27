var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
var { writeOutput } = require("./helpers/testOutput");

var materials = path.join(__dirname, "TestMaterials");
var notAnImage = path.join(materials, "fonts", "arial.ttf");
var notAFont = path.join(materials, "images", "png", "original.png");
var missing = path.join(materials, "missing");

// Each load fails; the writer must still finish the PDF.
var failedLoads = {
  "a missing JPG image": (writer) =>
    writer.createImageXObjectFromJPG(`${missing}.jpg`),
  "a JPG image that is not a JPG": (writer) =>
    writer.createImageXObjectFromJPG(notAnImage),
  "a missing JPG form": (writer) =>
    writer.createFormXObjectFromJPG(`${missing}.jpg`),
  "a missing PNG form": (writer) =>
    writer.createFormXObjectFromPNG(`${missing}.png`),
  "a PNG form that is not a PNG": (writer) =>
    writer.createFormXObjectFromPNG(notAnImage),
  "a missing TIFF form": (writer) =>
    writer.createFormXObjectFromTIFF(`${missing}.tif`),
  "a missing font": (writer) => writer.getFontForFile(`${missing}.ttf`),
  "a font that is not a font": (writer) => writer.getFontForFile(notAFont),
};

describe("Failed load recovery", function () {
  Object.entries(failedLoads).forEach(([name, load]) => {
    it(`ends the PDF after ${name}`, function () {
      var output = new muhammara.PDFWStreamForBuffer();
      var writer = muhammara.createWriter(output);

      assert.throws(() => load(writer), TypeError);
      // Loading the same input again fails the same way.
      assert.throws(() => load(writer), TypeError);
      writer.writePage(writer.createPage(0, 0, 100, 100));
      writer.end();
      writeOutput(
        `FailedLoadRecovery-${name.replace(/\W+/g, "-")}`,
        output.buffer,
      );

      var reader = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(output.buffer),
      );
      assert.equal(reader.getPagesCount(), 1);
      reader.end();
    });
  });

  it("rejects an unreadable Recipe image and keeps the rest", function () {
    var recipe = new muhammara.Recipe(Buffer.from("new"), null);
    recipe.createPage(100, 100);
    assert.throws(
      () => recipe.image(`${missing}.jpg`, 10, 10),
      new Error(`Unknown image: ${missing}.jpg`),
    );
    recipe.text("kept", 10, 50).endPage();
    recipe.endPDF((bytes) => {
      writeOutput("FailedLoadRecovery-recipe-image", bytes);
      var reader = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(bytes),
      );
      assert.equal(reader.getPagesCount(), 1);
      reader.end();
    });
  });
});
