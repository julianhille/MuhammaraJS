import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { describeEnd, fixture } from "../../support/ends.mjs";
import { attachments } from "../../support/metadata.mjs";

describeEnd("native", "Recipe attach", function (end) {
  it("takes a file path", function () {
    var file = fixture("icc/sRGB-v2-micro.icc");
    var bytes = end
      .newRecipe()
      .createPage(100, 100)
      .endPage()
      .attach("profile.icc", file)
      .endPDF();
    assert.equal(attachments(end, bytes).files[0].size, statSync(file).size);
  });
});
