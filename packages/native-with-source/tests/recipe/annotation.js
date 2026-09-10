var assert = require("node:assert/strict");
var fs = require("node:fs");
var os = require("node:os");
var path = require("node:path");
var muhammara = require("@muhammara/native-with-source");

describe("Recipe annotation", function () {
  var directory;
  var output;
  var reader;

  beforeEach(function () {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "recipe-annotation-"));
    output = path.join(directory, "annotations.pdf");
  });

  afterEach(function () {
    if (reader) reader.end();
    reader = undefined;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("writes links, comments, and square annotations", async function () {
    var recipe = new muhammara.Recipe("new", output)
      .createPage(595, 842)
      .link("https://example.com", 50, 300, 160, 24)
      .rectangle(50, 300, 160, 24, { fill: "#dbeafe" })
      .comment("A browser comment", 250, 300, { title: "Muhammara" })
      .annot(350, 300, "Square", {
        width: 60,
        height: 30,
        text: "A square",
      });
    await new Promise(function (resolve) {
      recipe.endPage().endPDF(resolve);
    });

    reader = muhammara.createReader(output);
    var page = reader.parsePage(0).getDictionary();
    var annotations = reader
      .queryDictionaryObject(page, "Annots")
      .toPDFArray()
      .toJSArray()
      .map(function (reference) {
        return reader
          .parseNewObject(
            reference.toPDFIndirectObjectReference().getObjectID(),
          )
          .toPDFDictionary()
          .toJSObject();
      });
    var link = annotations.find(function (annotation) {
      return annotation.Subtype.toString() === "Link";
    });

    assert.equal(
      link.A.toPDFDictionary().toJSObject().URI.toText(),
      "https://example.com",
    );
    assert.deepEqual(
      link.Rect.toPDFArray()
        .toJSArray()
        .map(function (value) {
          return value.toNumber();
        }),
      [50, 518, 210, 542],
    );
    assert.ok(
      annotations.some(function (annotation) {
        return annotation.Subtype.toString() === "Text";
      }),
    );
    assert.ok(
      annotations.some(function (annotation) {
        return annotation.Subtype.toString() === "Square";
      }),
    );
  });
});
