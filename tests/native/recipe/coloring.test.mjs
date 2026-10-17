import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeEnd, fixture, writeOutput } from "../../support/ends.mjs";
import { painted } from "../../support/geometry.mjs";

var OUTPUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../output/native",
);

// Native reads a color file from a path; Wasm reads registered assets or
// bytes and rejects a path (tests/wasm/recipe/coloring.test.mjs). Loading
// from bytes runs on both ends in tests/recipe/coloring.test.mjs.
describeEnd("native", "Coloring", function (end) {
  it("loads named colors from a JSON file path", function () {
    var bytes = end
      .newRecipe()
      .createPage(200, 200)
      .chroma("!load", fixture("recipe/rgb-colors.json"))
      .text("Burlywood from file load", 10, 10, {
        font: "arial",
        color: "burlywood",
      })
      .endPage()
      .endPDF();
    writeOutput(end, "coloring-load-path", bytes);
    var [text] = painted(end, bytes).filter((item) => item.kind === "text");
    assert.deepEqual(text.fill, {
      space: "DeviceRGB",
      values: [0.870588, 0.721569, 0.529412],
    });
  });

  it("rejects a color file path that names an inherited key as a colorspace", function () {
    mkdirSync(OUTPUT, { recursive: true });
    var colorFile = path.join(OUTPUT, "coloring-proto.json");
    writeFileSync(colorFile, '{"__proto__": {"polluted": "ff0000"}}');
    assert.throws(
      () => end.newRecipe().chroma("!load", colorFile),
      /Unrecognized colorspace: __proto__/,
    );
    assert.equal({}.polluted, undefined);
  });
});
