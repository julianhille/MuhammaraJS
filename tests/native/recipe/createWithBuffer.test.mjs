import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeEnd, fixture } from "../../support/ends.mjs";

var OUTPUT = fileURLToPath(new URL("../../output/native", import.meta.url));

describeEnd("native", "Recipe from a Buffer", function (end) {
  it("calls back with a Buffer when no output path is given", function () {
    var recipe = new end.Recipe(readFileSync(fixture("recipe/test.pdf")));
    var output;
    recipe
      .editPage(1)
      .endPage()
      .endPDF((buffer) => {
        output = buffer;
      });
    assert.ok(Buffer.isBuffer(output));
    assert.strictEqual(recipe.endPDF(), output);
  });

  it("writes the output path given with a Buffer source and calls back with it", function () {
    mkdirSync(OUTPUT, { recursive: true });
    var output = path.join(OUTPUT, "createWithBuffer-file-output.pdf");
    rmSync(output, { force: true });
    var result = new end.Recipe(
      readFileSync(fixture("recipe/test.pdf")),
      output,
    )
      .editPage(1)
      .endPage()
      .endPDF((given) => given);
    assert.equal(result, output);
    assert.ok(existsSync(output));
  });

  it("reads another PDF by path or Buffer alike", function () {
    var other = fixture("BasicTIFFImagesTest.PDF");
    var recipe = new end.Recipe(readFileSync(fixture("Original.pdf")));
    assert.equal(
      recipe.read(readFileSync(other)).pages,
      recipe.read(other).pages,
    );
    recipe.endPDF();
  });
});
