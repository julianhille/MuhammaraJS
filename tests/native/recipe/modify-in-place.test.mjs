import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeEnd, fixture } from "../../support/ends.mjs";
import { annotations, info } from "../../support/pdf.mjs";

var OUTPUT = fileURLToPath(new URL("../../output/native", import.meta.url));

describeEnd("native", "Recipe modify in place", function (end) {
  it("overwrites a path source without an output path", function () {
    mkdirSync(OUTPUT, { recursive: true });
    var file = path.join(OUTPUT, "modify-in-place.pdf");
    copyFileSync(fixture("recipe/test.pdf"), file);
    var recipe = new end.Recipe(file);
    recipe
      .info({ author: "wahaha" })
      .editPage(1)
      .text("Add some texts to an existing pdf file", 150, 300)
      .text(`${new Date()}`, 150, 350)
      .circle("center", 100, 60, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .rectangle("center", "center", 450, 450, {
        color: [255, 0, 255],
        opacity: 0.2,
      })
      .comment("Add 1st comment annotaion", 200, 300)
      .endPage();
    var result = recipe
      .editPage(2)
      .comment("Add 2nd comment annotaion", 200, 100)
      .endPage()
      .endPDF((...args) => args);
    // A path source calls back without an argument.
    assert.deepEqual(result, [undefined]);
    var bytes = readFileSync(file);
    assert.equal(info(end, bytes).Author, "wahaha");
    assert.deepEqual(
      annotations(end, bytes, 1).map((annot) => annot.Contents),
      ["Add 2nd comment annotaion"],
    );
  });
});
