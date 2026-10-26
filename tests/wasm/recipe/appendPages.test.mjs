import assert from "node:assert/strict";
import { describeEnd } from "../../support/ends.mjs";

describeEnd("wasm", "Recipe appendPages", function (end) {
  after(function () {
    end.Recipe.unregisterPdf("appendPages-inspected");
  });

  it("inspects a registered PDF without a Recipe", function () {
    var source = end.newRecipe().createPage(595, 842).endPage().endPDF();
    end.Recipe.registerPdf("appendPages-inspected", source);
    var metadata = end.Recipe.inspectPdf("appendPages-inspected");
    assert.equal(metadata.pages, 1);
    assert.equal(metadata[1].width, 595);
    assert.equal(metadata[1].height, 842);
  });

  it("names the type, not the content, of bytes passed as a registered name", function () {
    // The Recipe methods take PDF bytes as well as names (see the shared
    // spec); the registry statics take names only.
    var bytes = new Uint8Array([37, 80, 68, 70]);
    var error = {
      name: "TypeError",
      message: "Unknown PDF: expected a registered name, received Uint8Array",
    };
    assert.throws(() => end.Recipe.splitPdf(bytes), error);
    assert.throws(() => end.Recipe.inspectPdf(bytes), error);
    assert.throws(() => end.Recipe.inspectPdf("missing"), {
      name: "Error",
      message: "Unknown PDF: missing",
    });
  });
});
