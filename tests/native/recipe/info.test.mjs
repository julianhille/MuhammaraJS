import assert from "node:assert/strict";
import { copyFileSync, readFileSync, rmSync } from "node:fs";
import { describeEnd, fixture } from "../../support/ends.mjs";
import { info } from "../../support/pdf.mjs";
import { outputPath } from "../../support/metadata.mjs";

describeEnd("native", "Recipe info", function (end) {
  it("writes the Info of a path source to its output file", function () {
    var output = outputPath(end, "info-path-source.pdf");
    rmSync(output, { force: true });
    new end.Recipe(fixture("recipe/blank.pdf"), output)
      .info({ title: "Hello World" })
      .custom("some", "thing?")
      .endPDF();
    var read = new end.Recipe(output).info();
    assert.equal(read.title, "Hello World");
    assert.equal(read.some, "thing?");
  });

  it("edits a path source in place without an output path", function () {
    var file = outputPath(end, "info-in-place.pdf");
    copyFileSync(fixture("TrappedTrue.pdf"), file);
    new end.Recipe(file).info({ title: "in place" }).endPDF();
    assert.equal(info(end, readFileSync(file)).Title, "in place");
  });

  it("prints the PDF structure to a file", function () {
    var text = outputPath(end, "info-structure.txt");
    rmSync(text, { force: true });
    end.openRecipe("recipe/test3.pdf").structure(text).endPDF();
    var structure = readFileSync(text, "latin1");
    ["Info", "Root", "Size"].forEach((entry) =>
      assert.match(structure, new RegExp(`^${entry}\\r$`, "m")),
    );
  });

  it("prints the structure of a PDF without /Info", function () {
    var text = outputPath(end, "info-structure-no-info.txt");
    rmSync(text, { force: true });
    end.openRecipe("FontDifferences.pdf").structure(text).endPDF();
    var structure = readFileSync(text, "latin1");
    assert.doesNotMatch(structure, /^Info\r$/m);
    assert.match(structure, /^Root\r$/m);
  });
});
