import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm, createRecipe } from "../../index.js";

var AsyncFunction = async function () {}.constructor;
var readme = await readFile(
  new URL("../../README.md", import.meta.url),
  "utf8",
);
var examples = Array.from(readme.matchAll(/```js\n([\s\S]*?)```/g), (match) =>
  match[1].replace(/^import .* from "@muhammara\/wasm";\n/m, ""),
);

describe("@muhammara/wasm README examples", function () {
  var muhammara;
  var inputBytes;

  before(async function () {
    var Recipe = await createRecipe();
    muhammara = await createMuhammaraWasm();
    inputBytes = new Recipe().createPage("A4").endPage().endPDF();
  });

  it("imports only from the package entry point", function () {
    assert.equal(examples.length, 3);
    assert.equal(readme.match(/^import /gm).length, examples.length);
  });

  examples.forEach(function (source, index) {
    it(`runs example ${index + 1} and produces a PDF`, async function () {
      var pdf = await new AsyncFunction(
        "createRecipe",
        "createMuhammaraWasm",
        "inputBytes",
        source + "\nreturn typeof output === 'undefined' ? pdfBytes : output;",
      )(createRecipe, createMuhammaraWasm, inputBytes);

      assert.ok(pdf instanceof Uint8Array);
      assert.equal(new TextDecoder().decode(pdf.subarray(0, 5)), "%PDF-");
      var reader = muhammara.createReader(pdf);
      assert.equal(reader.getPagesCount(), 1);
      reader.end();
    });
  });
});
