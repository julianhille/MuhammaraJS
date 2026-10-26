// Fonts on native: the fontSrcPath option registers every font file of a
// folder by its file name. Wasm takes registered font bytes instead.
import assert from "node:assert/strict";
import { describeEnd, fixture, writeOutput } from "../../support/ends.mjs";
import { runFonts } from "../../support/text.mjs";

describeEnd("native", "Recipe font", function (end) {
  it("registers the fonts of the fontSrcPath folders by file name", function () {
    var bytes = new end.Recipe(Buffer.from("new"), undefined, {
      fontSrcPath: fixture("fonts"),
    })
      .createPage("letter")
      .text("世界你好 日本語", "center", 80, {
        font: "KozGoPro-Regular",
        textBox: { style: { fill: "%0,28,100,6" } },
      })
      .text("Lucida Grande from a font collection", "center", 120, {
        font: "LucidaGrande",
      })
      .endPage()
      .endPDF((output) => output);
    writeOutput(end, "font-fontSrcPath", bytes);
    var runs = runFonts(end, bytes);
    assert.equal(
      runs
        .filter((run) => run.font === "KozGoPro-Regular")
        .map((run) => run.text)
        .join(""),
      "世界你好 日本語",
    );
    assert.ok(
      runs.some(
        (run) =>
          run.font === "LucidaGrande" &&
          run.text === "Lucida Grande from a font collection",
      ),
    );
  });
});
