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

  it("opens the same PDF from a path, Buffer, Uint8Array and ArrayBuffer", function () {
    var src = fixture("Original.pdf");
    var buffer = readFileSync(src);
    // An offset view checks that only the viewed bytes are read
    var padded = new Uint8Array(buffer.length + 8);
    padded.set(buffer, 4);
    var pages = new end.Recipe(src).read().pages;
    [
      buffer,
      padded.subarray(4, 4 + buffer.length),
      new Uint8Array(buffer).buffer,
    ].forEach((source) => {
      var recipe = new end.Recipe(source);
      assert.deepEqual(recipe.read().pages, pages);
      var output;
      recipe.endPDF((result) => {
        output = result;
      });
      assert.equal(output.subarray(0, 5).toString(), "%PDF-");
    });
  });

  it("rejects a source that is neither a path nor bytes", function () {
    [undefined, 42, {}].forEach((source) => {
      assert.throws(() => new end.Recipe(source), {
        name: "TypeError",
        message:
          "Recipe source must be a path string, Buffer, Uint8Array or ArrayBuffer",
      });
    });
  });

  it("reads another PDF by path or bytes alike", function () {
    var other = fixture("BasicTIFFImagesTest.PDF");
    var recipe = new end.Recipe(readFileSync(fixture("Original.pdf")));
    var otherBuffer = readFileSync(other);
    [
      otherBuffer,
      new Uint8Array(otherBuffer),
      new Uint8Array(otherBuffer).buffer,
    ].forEach((source) => {
      assert.equal(recipe.read(source).pages, recipe.read(other).pages);
    });
    assert.throws(() => recipe.read(42), {
      name: "TypeError",
      message:
        "Recipe source must be a path string, Buffer, Uint8Array or ArrayBuffer",
    });
    recipe.endPDF();
  });
});
