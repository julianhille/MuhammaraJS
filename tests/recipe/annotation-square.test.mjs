import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { readAnnotations, subtypes } from "../support/annotations.mjs";

describeEnds("Annotation: Square", function (end) {
  it("adds a simple square", function () {
    var bytes = end
      .newRecipe()
      .createPage("letter")
      .annot("center", "center", "Square", {
        text: "yo, I am a square",
        width: 200,
        height: 100,
        border: 10,
        color: [128, 31, 80],
      })
      .endPage()
      .endPDF();
    writeOutput(end, "annotation-square", bytes);
    var annotations = readAnnotations(end, bytes);
    assert.deepEqual(subtypes(annotations), ["Square"]);
    var [square] = annotations;
    assert.equal(square.Contents, "yo, I am a square");
    assert.deepEqual(square.Border, [0, 0, 10]);
    assert.deepEqual(
      square.C.map((part) => Math.round(part * 255)),
      [128, 31, 80],
    );
    // Its top-left corner is the center of the 612x792 letter page.
    assert.deepEqual(square.Rect, [306, 296, 506, 396]);
  });
});
