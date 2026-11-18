var assert = require("assert");
var fs = require("fs");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

// One-page PDFs showing "Before" in Helvetica, encrypted with RC4 and with
// AES-128 under an owner password only, so they open without a password.
// replaceText() and removeText() ended the indirect object of the stream
// they wrote again after endPDFStream() had ended it, which popped an
// empty key list of the encryption and crashed.
describe("GHSA-3p2c-cw9w-9746", function () {
  ["OwnerOnlyRC4.pdf", "OwnerOnlyAES128.pdf"].forEach(function (fixture) {
    [
      [
        "replaceText",
        (recipe) => recipe.replaceText("Before", "Bore", 1),
        "Bore",
      ],
      ["removeText", (recipe) => recipe.removeText(1), ""],
    ].forEach(function ([method, edit, text]) {
      it(`${method}() writes an encrypted ${fixture}`, function () {
        var target = path.join(
          __dirname,
          `../output/GHSA-3p2c-cw9w-9746-${method}-${fixture}`,
        );
        var recipe = new muhammara.Recipe(
          path.join(__dirname, "../TestMaterials", fixture),
          target,
        );
        edit(recipe);
        recipe.endPDF();

        assert.doesNotMatch(
          fs.readFileSync(target, "latin1"),
          /endobj\s+endobj/,
        );
        var reader = muhammara.createReader(target);
        try {
          assert.ok(reader.isEncrypted());
          assert.strictEqual(
            reader
              .extractPageText(0)
              .map((item) => item.text)
              .join(""),
            text,
          );
        } finally {
          reader.end();
        }
      });
    });
  });
});
