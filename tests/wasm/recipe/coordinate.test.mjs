import assert from "node:assert/strict";
import { describeEnd } from "../../support/ends.mjs";

describeEnd("wasm", "Recipe coordinates", function (end) {
  after(function () {
    end.Recipe.unregisterPdf("coordinate-rotated-source");
  });

  it("inspects a registered PDF with the geometry a Recipe reads", function () {
    var M = end.muhammara;
    var source = end
      .newRecipe()
      .createPage(200, 300)
      .setPageBox(M.ePDFPageBoxMediaBox, 10, 20, 210, 320)
      .rotate(90)
      .endPage()
      .endPDF();
    end.Recipe.registerPdf("coordinate-rotated-source", source);
    var page = {
      pageNumber: 1,
      mediaBox: [10, 20, 210, 320],
      rotate: 90,
      width: 300,
      height: 200,
      layout: "landscape",
      size: [200, 300],
      offsetX: 10,
      offsetY: 20,
    };
    assert.deepEqual(
      end.Recipe.inspectPdf("coordinate-rotated-source")[1],
      page,
    );
    assert.deepEqual(end.openRecipe(source).metadata[1], page);
  });
});
