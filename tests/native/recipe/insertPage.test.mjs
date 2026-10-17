import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeEnd, fixture } from "../../support/ends.mjs";
import { pageCount } from "../../support/pdf.mjs";

var OUTPUT = fileURLToPath(new URL("../../output/native", import.meta.url));

describeEnd("native", "Recipe insertPage", function (end) {
  it("writes a path source with inserted pages to its output path", function () {
    mkdirSync(OUTPUT, { recursive: true });
    var output = path.join(OUTPUT, "insertPage-path-output.pdf");
    rmSync(output, { force: true });
    var args;
    new end.Recipe(fixture("recipe/test.pdf"), output)
      .insertPage(0, fixture("recipe/compressed.tracemonkey-pldi-09.pdf"), 3)
      .insertPage(14, fixture("recipe/compressed.tracemonkey-pldi-09.pdf"), 1)
      .endPDF((...given) => {
        args = given;
      });
    assert.deepEqual(args, [undefined]);
    assert.equal(pageCount(end, readFileSync(output)), 16);
  });
});
