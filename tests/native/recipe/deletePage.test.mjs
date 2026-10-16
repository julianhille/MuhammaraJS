import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeEnd } from "../../support/ends.mjs";
import { numberedPdf, pageWidths } from "../../support/composition.mjs";

var OUTPUT = fileURLToPath(new URL("../../output/native", import.meta.url));

/**
 * A fresh path in the native output folder.
 * @param {string} name - The file name without extension.
 * @returns {string} The path, with no file at it yet.
 */
function outputPath(name) {
  mkdirSync(OUTPUT, { recursive: true });
  var file = path.join(OUTPUT, `${name}.pdf`);
  rmSync(file, { force: true });
  return file;
}

describeEnd("native", "Recipe deletePage", function (end) {
  var sourceBytes;

  before(function () {
    sourceBytes = numberedPdf(end);
  });

  it("writes a path source with deleted pages to its output path", function () {
    var source = outputPath("deletePage-path-source");
    writeFileSync(source, sourceBytes);
    var output = outputPath("deletePage-path-output");
    var args;
    new end.Recipe(source, output)
      .deletePage([11, 2, 4, 4])
      .deletePage(1)
      .endPDF((...given) => {
        args = given;
      });
    assert.deepEqual(args, [undefined]);
    assert.deepEqual(
      pageWidths(end, readFileSync(output)),
      [103, 105, 106, 107, 108, 109, 110, 112],
    );
    // The source file is left as it was.
    assert.deepEqual(readFileSync(source), sourceBytes);
  });

  it("deletes pages of a path source in place without an output path", function () {
    var source = outputPath("deletePage-in-place");
    writeFileSync(source, sourceBytes);
    new end.Recipe(source).deletePage([1, 12]).endPDF();
    assert.deepEqual(
      pageWidths(end, readFileSync(source)),
      [102, 103, 104, 105, 106, 107, 108, 109, 110, 111],
    );
  });
});
