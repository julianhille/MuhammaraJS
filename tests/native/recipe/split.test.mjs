import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeEnd, fixture } from "../../support/ends.mjs";
import { pageCount } from "../../support/pdf.mjs";

var OUTPUT = fileURLToPath(new URL("../../output/native", import.meta.url));

describeEnd("native", "Recipe split", function (end) {
  it("writes each page into the output directory, named after the source file", function () {
    var dir = path.join(OUTPUT, "split-path-source");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    var source = path.join(dir, "split.source.pdf");
    copyFileSync(fixture("recipe/compressed.tracemonkey-pldi-09.pdf"), source);

    var recipe = new end.Recipe(source);
    // split() returns the Recipe, so the chain can end the document.
    assert.equal(recipe.split(dir), recipe);
    recipe.endPDF();

    var parts = readdirSync(dir).filter((name) => name !== "split.source.pdf");
    assert.deepEqual(
      parts.sort(),
      Array.from(
        { length: 14 },
        (_, i) => `split.source.pdf-${i + 1}.pdf`,
      ).sort(),
    );
    parts.forEach((name) =>
      assert.equal(pageCount(end, readFileSync(path.join(dir, name))), 1),
    );
  });
});
