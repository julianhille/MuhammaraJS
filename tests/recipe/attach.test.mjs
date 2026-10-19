import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeEnds, fixture, writeOutput } from "../support/ends.mjs";
import { attachments } from "../support/metadata.mjs";

var encoder = new TextEncoder();

describeEnds("Recipe attach", function (end) {
  /**
   * Create a one page PDF with attached files.
   * @param {function(object): void} attach - Attaches the files.
   * @param {string} name - The output name suffix.
   * @returns {Uint8Array} The PDF.
   */
  function create(attach, name) {
    var recipe = end.newRecipe().createPage(100, 100).endPage();
    attach(recipe);
    var bytes = recipe.endPDF();
    writeOutput(end, "attach-" + name, bytes);
    return bytes;
  }

  it("attaches files with their details", function () {
    var bytes = create(
      (recipe) =>
        recipe
          .attach("notes ä.txt", encoder.encode("hello"), null)
          .attach("data.xml", encoder.encode("<x>ä</x>"), {
            mimeType: "text/xml",
            description: "Die Daten",
            relationship: end.Recipe.AFRelationship.DATA,
          }),
      "details",
    );
    var { files, associated } = attachments(end, bytes);
    assert.equal(associated, 2);
    assert.deepEqual(files, [
      {
        key: "data.xml",
        name: "data.xml",
        description: "Die Daten",
        relationship: "Data",
        mimeType: "text/xml",
        size: 9,
        content: "<x>ä</x>",
      },
      {
        key: "notes ä.txt",
        name: "notes ä.txt",
        description: undefined,
        relationship: "Unspecified",
        mimeType: "application/octet-stream",
        size: 5,
        content: "hello",
      },
    ]);
  });

  it("sorts the names by their encoded bytes", function () {
    var bytes = create(
      (recipe) =>
        recipe
          .attach("ä.txt", encoder.encode("a"))
          .attach("€.txt", encoder.encode("b")),
      "sort",
    );
    // PDFDocEncoding puts the euro sign (0xA0) before a-umlaut (0xE4)
    assert.deepEqual(
      attachments(end, bytes).files.map((file) => file.key),
      ["€.txt", "ä.txt"],
    );
  });

  it("replaces a file attached again under the same name", function () {
    var bytes = create(
      (recipe) =>
        recipe
          .attach("a.txt", encoder.encode("old"))
          .attach("a.txt", encoder.encode("new")),
      "replace",
    );
    assert.deepEqual(
      attachments(end, bytes).files.map((file) => file.content),
      ["new"],
    );
  });

  it("takes an ArrayBuffer", function () {
    var bytes = create(
      (recipe) => recipe.attach("a.txt", encoder.encode("buffer").buffer),
      "array-buffer",
    );
    assert.equal(attachments(end, bytes).files[0].content, "buffer");
  });

  it("keeps the files when annotations are written", function () {
    var recipe = end
      .newRecipe()
      .createPage(100, 100)
      .comment("note", 10, 10)
      .endPage();
    recipe.attach("a.txt", encoder.encode("text"));
    var bytes = recipe.endPDF();
    assert.deepEqual(
      attachments(end, bytes).files.map((file) => file.content),
      ["text"],
    );
  });

  it("cannot be combined with insertPage()", function () {
    var source = end.pdf("recipe/test.pdf");
    var message = {
      message: "insertPage() cannot be combined with pdfa or attach()",
    };
    var recipe = end.newRecipe().attach("a", encoder.encode("x"));
    assert.throws(() => recipe.insertPage(0, source, 1), message);
    recipe = end.newRecipe().insertPage(0, source, 1);
    assert.throws(() => recipe.attach("a", encoder.encode("x")), message);
    recipe = end.newRecipe({
      pdfa: {
        level: end.Recipe.PdfA.A3B,
        iccProfile: new Uint8Array(
          readFileSync(fixture("icc/sRGB-v2-micro.icc")),
        ),
      },
    });
    assert.throws(() => recipe.insertPage(0, source, 1), message);
  });

  it("rejects what it cannot attach", function () {
    var recipe = end.newRecipe();
    assert.throws(() => recipe.attach("", encoder.encode("x")), {
      name: "TypeError",
      message: "An attached file needs a name",
    });
    assert.throws(() => recipe.attach("a", 42), {
      name: "TypeError",
      message: "An attached file needs its bytes",
    });
    assert.throws(
      () => recipe.attach("a", encoder.encode("x"), { relationship: "Other" }),
      {
        name: "TypeError",
        message: "Unknown relationship Other; use an AFRelationship value",
      },
    );
    assert.throws(
      () =>
        recipe.attach("a", encoder.encode("x"), {
          mimeType: "text/xml; charset=utf-8",
        }),
      {
        name: "TypeError",
        message: "Invalid MIME type text/xml; charset=utf-8; use type/subtype",
      },
    );
    assert.throws(
      () => recipe.attach("a", encoder.encode("x"), { description: 42 }),
      {
        name: "TypeError",
        message: "An attached file's description must be a string",
      },
    );
    [new Date("x"), 1234567890000].forEach((modDate) =>
      assert.throws(
        () => recipe.attach("a", encoder.encode("x"), { modDate }),
        {
          name: "TypeError",
          message: "An attached file's modDate must be a valid Date",
        },
      ),
    );
    recipe.createPage(100, 100).endPage();
    var bytes = recipe.endPDF();
    assert.throws(() => recipe.attach("a", encoder.encode("x")), {
      message: "PDF writer has ended",
    });
    var source = end.openRecipe(bytes);
    assert.throws(() => source.attach("a", encoder.encode("x")), {
      message: "attach() applies to a new PDF",
    });
    source.endPDF();
  });
});
