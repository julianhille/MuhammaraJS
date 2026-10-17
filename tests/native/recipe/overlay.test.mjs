import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeEnd, fixture } from "../../support/ends.mjs";
import { drawnContent, pageContent } from "../../support/pdf.mjs";

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

describeEnd("native", "Recipe overlay", function (end) {
  it("releases the overlaid file once the PDF is written", function () {
    var source = outputPath("overlay-handles-source");
    var overlaid = outputPath("overlay-handles-overlaid");
    var output = outputPath("overlay-handles-result");
    copyFileSync(fixture("recipe/test2.pdf"), source);
    copyFileSync(fixture("recipe/test2.pdf"), overlaid);

    new end.Recipe(source, output)
      .editPage(1)
      .overlay(overlaid)
      .endPage()
      .endPDF();
    var overlaidContent = pageContent(end, readFileSync(overlaid));
    assert.ok(
      drawnContent(end, readFileSync(output)).includes(overlaidContent),
    );

    // Both files stay locked on Windows while a reader still holds them:
    // https://github.com/julianhille/MuhammaraJS/issues/381
    unlinkSync(source);
    unlinkSync(overlaid);
  });
});
