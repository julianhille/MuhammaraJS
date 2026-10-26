import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeEnd } from "../../support/ends.mjs";
import { pageCount } from "../../support/pdf.mjs";

var OUTPUT = fileURLToPath(new URL("../../output/native", import.meta.url));

describeEnd("native", "Recipe endPDF called twice", function (end) {
  it("writes the output path once and does not throw on a second call", function () {
    mkdirSync(OUTPUT, { recursive: true });
    var output = path.join(OUTPUT, "endPDF-twice-path.pdf");
    rmSync(output, { force: true });
    var recipe = new end.Recipe("new", output);
    recipe.createPage("letter").endPage().endPDF();
    var written = statSync(output).mtimeMs;

    assert.doesNotThrow(() => recipe.endPDF());
    var args;
    recipe.endPDF((...given) => {
      args = given;
    });
    // A path output calls back without an argument, every time.
    assert.deepEqual(args, [undefined]);
    assert.equal(statSync(output).mtimeMs, written);
    assert.equal(pageCount(end, readFileSync(output)), 1);
  });
});
