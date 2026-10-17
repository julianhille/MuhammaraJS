import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { describeEnd, fixture } from "../../support/ends.mjs";
import { opens, outputPath } from "../../support/metadata.mjs";

describeEnd("native", "Recipe encryption", function (end) {
  it("encrypts the output file of a path source", function () {
    [
      { options: { userPassword: "123" }, password: "123" },
      { options: { ownerPassword: "123" } },
      { options: { password: "123" } },
    ].forEach(({ options, password }, index) => {
      var output = outputPath(end, `encryption-path-source-${index}.pdf`);
      rmSync(output, { force: true });
      var recipe = new end.Recipe(fixture("recipe/test2.pdf"), output);
      assert.equal(recipe.encrypt(options).endPDF(), undefined);
      var bytes = readFileSync(output);
      assert.equal(opens(end, bytes, password), true);
      if (password) assert.equal(opens(end, bytes), false);
    });
  });

  it("encrypts the output file of a new PDF with constructor passwords", function () {
    var output = outputPath(end, "encryption-new-path.pdf");
    rmSync(output, { force: true });
    new end.Recipe("new", output, { userPassword: "first" })
      .createPage("letter")
      .endPage()
      .encrypt({ userPassword: "second" })
      .endPDF();
    var bytes = readFileSync(output);
    assert.equal(opens(end, bytes, "first"), false);
    assert.equal(opens(end, bytes, "second"), true);
  });

  it("hands the output path of a Buffer source to the endPDF() callback", function () {
    var output = outputPath(end, "encryption-buffer-to-path.pdf");
    rmSync(output, { force: true });
    var recipe = new end.Recipe(
      readFileSync(fixture("recipe/test2.pdf")),
      output,
    );
    var result = recipe
      .encrypt({ ownerPassword: "123", userProtectionFlag: 4 })
      .endPDF((outputPath) => outputPath);
    assert.equal(result, output);
    assert.equal(opens(end, readFileSync(output)), true);
    assert.equal(opens(end, readFileSync(output), "123"), true);
  });

  it("returns a Buffer for a Buffer source", function () {
    var bytes = end
      .openRecipe("recipe/test2.pdf")
      .encrypt({ userPassword: "123" })
      .endPDF();
    assert.ok(Buffer.isBuffer(bytes));
  });
});
