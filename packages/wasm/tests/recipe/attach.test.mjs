// Ports tests/recipe/attach.js.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMuhammaraWasm, createRecipe } from "../../index.js";
import { writeOutput } from "../testOutput.mjs";

var muhammara;
var Recipe;
var encoder = new TextEncoder();

/**
 * Creates a one page PDF with attached files.
 * @param {function(object): void} attach Attaches the files.
 * @param {string} name Output name suffix.
 * @returns {Uint8Array} The PDF.
 */
function create(attach, name) {
  var recipe = new Recipe();
  recipe.createPage(100, 100).endPage();
  attach(recipe);
  var bytes = recipe.endPDF();
  writeOutput("attach-" + name, bytes);
  return bytes;
}

/**
 * Reads the attached files of a PDF through its name tree and /AF.
 * @param {Uint8Array} bytes The PDF.
 * @returns {{files: Object[], associated: number}} Each file in name-tree
 *   order, and the number of associated files the catalog lists.
 */
function attachments(bytes) {
  var reader = muhammara.createReader(bytes);
  try {
    var catalog = reader.queryDictionaryObject(reader.getTrailer(), "Root");
    var names = reader.queryDictionaryObject(
      reader.queryDictionaryObject(
        reader.queryDictionaryObject(catalog, "Names"),
        "EmbeddedFiles",
      ),
      "Names",
    );
    var files = [];
    for (var i = 0; i < names.getLength(); i += 2) {
      var spec = reader.queryArrayObject(names, i + 1);
      var stream = reader.queryDictionaryObject(
        reader.queryDictionaryObject(spec, "EF"),
        "F",
      );
      var input = reader.startReadingFromStream(stream);
      var chunks = [];
      while (input.notEnded()) chunks.push(...input.read(4096));
      var streamDictionary = stream.getDictionary();
      var params = reader.queryDictionaryObject(streamDictionary, "Params");
      files.push({
        key: reader.queryArrayObject(names, i).toText(),
        name: spec.queryObject("UF").toText(),
        description: spec.toJSObject().Desc?.toText(),
        relationship: spec.queryObject("AFRelationship").value,
        mimeType: streamDictionary.queryObject("Subtype").value,
        size: params.queryObject("Size").value,
        content: new TextDecoder().decode(Uint8Array.from(chunks)),
      });
    }
    var associated = reader.queryDictionaryObject(catalog, "AF").getLength();
    return { files, associated };
  } finally {
    reader.end();
  }
}

describe("Recipe attach", function () {
  before(async function () {
    muhammara = await createMuhammaraWasm();
    Recipe = await createRecipe();
  });

  it("attaches files with their details", function () {
    var bytes = create(
      (recipe) =>
        recipe
          .attach("notes ä.txt", encoder.encode("hello"), null)
          .attach("data.xml", encoder.encode("<x>ä</x>"), {
            mimeType: "text/xml",
            description: "Die Daten",
            relationship: Recipe.AFRelationship.DATA,
          }),
      "details",
    );
    var { files, associated } = attachments(bytes);
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
          .attach("\u00e4.txt", encoder.encode("a"))
          .attach("\u20ac.txt", encoder.encode("b")),
      "sort",
    );
    // PDFDocEncoding puts the euro sign (0xA0) before a-umlaut (0xE4)
    assert.deepEqual(
      attachments(bytes).files.map((file) => file.key),
      ["\u20ac.txt", "\u00e4.txt"],
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
    var { files } = attachments(bytes);
    assert.deepEqual(
      files.map((file) => file.content),
      ["new"],
    );
  });

  it("takes an ArrayBuffer", function () {
    var bytes = create(
      (recipe) => recipe.attach("a.txt", encoder.encode("buffer").buffer),
      "array-buffer",
    );
    assert.equal(attachments(bytes).files[0].content, "buffer");
  });

  it("keeps the files when annotations are written", function () {
    var recipe = new Recipe();
    recipe.createPage(100, 100).comment("note", 10, 10).endPage();
    recipe.attach("a.txt", encoder.encode("text"));
    var bytes = recipe.endPDF();
    assert.deepEqual(
      attachments(bytes).files.map((file) => file.content),
      ["text"],
    );
  });

  it("cannot be combined with insertPage()", function () {
    var source = new Recipe().createPage(100, 100).endPage().endPDF();
    Recipe.registerPdf("attach-insert-source", source);
    var message = {
      message: "insertPage() cannot be combined with pdfa or attach()",
    };
    var recipe = new Recipe().attach("a", encoder.encode("x"));
    assert.throws(
      () => recipe.insertPage(0, "attach-insert-source", 1),
      message,
    );
    recipe = new Recipe().insertPage(0, "attach-insert-source", 1);
    assert.throws(() => recipe.attach("a", encoder.encode("x")), message);
    var iccProfile = readFileSync(
      new URL(
        "../../../native-with-source/tests/TestMaterials/icc/sRGB-v2-micro.icc",
        import.meta.url,
      ),
    );
    recipe = new Recipe({ pdfa: { level: Recipe.PdfA.A3B, iccProfile } });
    assert.throws(
      () => recipe.insertPage(0, "attach-insert-source", 1),
      message,
    );
  });

  it("rejects what it cannot attach", function () {
    var recipe = new Recipe();
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
    var source = new Recipe(bytes);
    assert.throws(() => source.attach("a", encoder.encode("x")), {
      message: "attach() applies to a new PDF",
    });
    source.endPDF();
  });
});
