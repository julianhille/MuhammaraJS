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
import { pageCount } from "../../support/pdf.mjs";

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

describeEnd("native", "Recipe appendPages", function (end) {
  it("releases the input files once the PDF is written", function () {
    var source = outputPath("appendPages-handles-source");
    var appended = outputPath("appendPages-handles-appended");
    var output = outputPath("appendPages-handles-result");
    copyFileSync(fixture("recipe/test.pdf"), source);
    copyFileSync(fixture("recipe/test.pdf"), appended);

    new end.Recipe(source, output).appendPage(appended).endPDF();
    assert.equal(pageCount(end, readFileSync(output)), 28);

    // Windows refuses the unlink with EBUSY while a reader still holds the
    // file, which is what https://github.com/julianhille/MuhammaraJS/issues/381
    // reported.
    unlinkSync(source);
    unlinkSync(appended);
  });
});
