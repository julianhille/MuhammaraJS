var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var muhammara = require("@muhammara/native-with-source");
var { writeOutput } = require("../helpers/testOutput");

var Recipe = muhammara.Recipe;

/**
 * Creates a one page PDF with attached files.
 * @param {function(Recipe): void} attach Attaches the files.
 * @param {string} name Output name suffix.
 * @returns {Buffer} The PDF.
 */
function create(attach, name) {
  var recipe = new Recipe(Buffer.from("new"));
  recipe.createPage(100, 100).endPage();
  attach(recipe);
  var bytes = recipe.endPDF((output) => output);
  writeOutput("attach-" + name, bytes);
  return bytes;
}

/**
 * Reads the attached files of a PDF through its name tree and /AF.
 * @param {Buffer} bytes The PDF.
 * @returns {{files: Object[], associated: number}} Each file in name-tree
 *   order, and the number of associated files the catalog lists.
 */
function attachments(bytes) {
  var reader = muhammara.createReader(new muhammara.PDFRStreamForBuffer(bytes));
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
      while (input.notEnded()) chunks.push(Buffer.from(input.read(4096)));
      var streamDictionary = stream.getDictionary();
      var params = reader.queryDictionaryObject(streamDictionary, "Params");
      files.push({
        key: reader.queryArrayObject(names, i).toText(),
        name: spec.queryObject("UF").toText(),
        description: spec.toJSObject().Desc?.toText(),
        relationship: spec.queryObject("AFRelationship").value,
        mimeType: streamDictionary.queryObject("Subtype").value,
        size: params.queryObject("Size").value,
        content: Buffer.concat(chunks).toString(),
      });
    }
    var associated = reader.queryDictionaryObject(catalog, "AF").getLength();
    return { files, associated };
  } finally {
    reader.end();
  }
}

describe("Recipe attach", function () {
  it("attaches files with their details", function () {
    var bytes = create(
      (recipe) =>
        recipe
          .attach("notes ä.txt", Buffer.from("hello"), null)
          .attach("data.xml", Buffer.from("<x>ä</x>"), {
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
          .attach("\u00e4.txt", Buffer.from("a"))
          .attach("\u20ac.txt", Buffer.from("b")),
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
          .attach("a.txt", Buffer.from("old"))
          .attach("a.txt", Buffer.from("new")),
      "replace",
    );
    var { files } = attachments(bytes);
    assert.deepEqual(
      files.map((file) => file.content),
      ["new"],
    );
  });

  it("takes a file path", function () {
    var file = path.join(__dirname, "../TestMaterials/icc/sRGB-v2-micro.icc");
    var bytes = create((recipe) => recipe.attach("profile.icc", file), "path");
    assert.equal(attachments(bytes).files[0].size, fs.statSync(file).size);
  });

  it("keeps the files when annotations are written", function () {
    var recipe = new Recipe(Buffer.from("new"));
    recipe.createPage(100, 100).comment("note", 10, 10).endPage();
    recipe.attach("a.txt", Buffer.from("text"));
    var bytes = recipe.endPDF((output) => output);
    assert.deepEqual(
      attachments(bytes).files.map((file) => file.content),
      ["text"],
    );
  });

  it("cannot be combined with insertPage()", function () {
    var source = path.join(__dirname, "../TestMaterials/recipe/test.pdf");
    var message = {
      message: "insertPage() cannot be combined with pdfa or attach()",
    };
    var recipe = new Recipe(Buffer.from("new")).attach("a", Buffer.from("x"));
    assert.throws(() => recipe.insertPage(0, source, 1), message);
    recipe = new Recipe(Buffer.from("new")).insertPage(0, source, 1);
    assert.throws(() => recipe.attach("a", Buffer.from("x")), message);
    recipe = new Recipe(Buffer.from("new"), undefined, {
      pdfa: {
        level: Recipe.PdfA.A3B,
        iccProfile: path.join(
          __dirname,
          "../TestMaterials/icc/sRGB-v2-micro.icc",
        ),
      },
    });
    assert.throws(() => recipe.insertPage(0, source, 1), message);
  });

  it("rejects what it cannot attach", function () {
    var recipe = new Recipe(Buffer.from("new"));
    assert.throws(() => recipe.attach("", Buffer.from("x")), {
      name: "TypeError",
      message: "An attached file needs a name",
    });
    assert.throws(() => recipe.attach("a", 42), {
      name: "TypeError",
      message: "An attached file needs its bytes",
    });
    assert.throws(
      () => recipe.attach("a", Buffer.from("x"), { relationship: "Other" }),
      {
        name: "TypeError",
        message: "Unknown relationship Other; use an AFRelationship value",
      },
    );
    assert.throws(
      () =>
        recipe.attach("a", Buffer.from("x"), {
          mimeType: "text/xml; charset=utf-8",
        }),
      {
        name: "TypeError",
        message: "Invalid MIME type text/xml; charset=utf-8; use type/subtype",
      },
    );
    assert.throws(
      () => recipe.attach("a", Buffer.from("x"), { description: 42 }),
      {
        name: "TypeError",
        message: "An attached file's description must be a string",
      },
    );
    [new Date("x"), 1234567890000].forEach((modDate) =>
      assert.throws(() => recipe.attach("a", Buffer.from("x"), { modDate }), {
        name: "TypeError",
        message: "An attached file's modDate must be a valid Date",
      }),
    );
    recipe.createPage(100, 100).endPage();
    var bytes = recipe.endPDF((output) => output);
    assert.throws(() => recipe.attach("a", Buffer.from("x")), {
      message: "PDF writer has ended",
    });
    var source = new Recipe(bytes);
    assert.throws(() => source.attach("a", Buffer.from("x")), {
      message: "attach() applies to a new PDF",
    });
    source.endPDF();
  });
});
