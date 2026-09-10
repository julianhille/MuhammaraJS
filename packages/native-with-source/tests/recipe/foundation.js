var assert = require("node:assert/strict");
var muhammara = require("@muhammara/native-with-source");

describe("Recipe foundation", function () {
  it("writes page boxes using PDF bottom-left coordinates", function () {
    var recipe = new muhammara.Recipe(Buffer.from("new"))
      .createPage(200, 300)
      .setPageBox(muhammara.ePDFPageBoxMediaBox, 10, 20, 210, 320)
      .setPageBox(muhammara.ePDFPageBoxCropBox, 11, 21, 209, 319)
      .setPageBox(muhammara.ePDFPageBoxBleedBox, 12, 22, 208, 318)
      .setPageBox(muhammara.ePDFPageBoxTrimBox, 13, 23, 207, 317)
      .setPageBox(muhammara.ePDFPageBoxArtBox, 14, 24, 206, 316);
    assert.deepEqual(recipe._calibrateCoordinate("center", "center"), {
      nx: 110,
      ny: 170,
    });

    var bytes = recipe.endPage().endPDF(function (output) {
      return output;
    });
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(bytes),
    );
    try {
      var page = reader.parsePage(0);
      assert.deepEqual(page.getMediaBox(), [10, 20, 210, 320]);
      assert.deepEqual(page.getCropBox(), [11, 21, 209, 319]);
      assert.deepEqual(page.getBleedBox(), [12, 22, 208, 318]);
      assert.deepEqual(page.getTrimBox(), [13, 23, 207, 317]);
      assert.deepEqual(page.getArtBox(), [14, 24, 206, 316]);
    } finally {
      reader.end();
    }
  });

  it("rejects unknown page boxes", function () {
    var recipe = new muhammara.Recipe(Buffer.from("new")).createPage();
    assert.throws(function () {
      recipe.setPageBox(5, 0, 0, 1, 1);
    }, /Unknown page box: 5/);
    recipe.endPage().endPDF();
  });
});
