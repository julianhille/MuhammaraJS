var assert = require("node:assert/strict");
var fs = require("node:fs");
var os = require("node:os");
var path = require("node:path");
var muhammara = require("@muhammara/native-with-source");

function readAnnotations(reader) {
  var page = reader.parsePage(0).getDictionary();
  return reader
    .queryDictionaryObject(page, "Annots")
    .toPDFArray()
    .toJSArray()
    .map(function (reference) {
      var id = reference.toPDFIndirectObjectReference().getObjectID();
      return {
        id: id,
        dictionary: reader.parseNewObject(id).toPDFDictionary().toJSObject(),
      };
    });
}

describe("Recipe annotation parity", function () {
  var directory;
  var output;
  var reader;

  beforeEach(function () {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "annotation-parity-"));
    output = path.join(directory, "annotations.pdf");
  });

  afterEach(function () {
    if (reader) reader.end();
    reader = undefined;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  async function finish(recipe) {
    await new Promise(function (resolve) {
      recipe.endPage().endPDF(resolve);
    });
    reader = muhammara.createReader(output);
    return readAnnotations(reader);
  }

  it("writes fractional and zero opacity while keeping the opaque default", async function () {
    var recipe = new muhammara.Recipe("new", output).createPage(595, 842);
    var opacities = [0.45, 0, 1, undefined];
    opacities.forEach(function (opacity, index) {
      recipe.annot(100, 200 + index * 30, "Highlight", {
        width: 200,
        height: 14,
        color: "#ffff00",
        opacity: opacity,
      });
    });
    var annotations = await finish(recipe);
    assert.equal(annotations.length, opacities.length);
    annotations.forEach(function (annotation, index) {
      var dictionary = annotation.dictionary;
      assert.equal(dictionary.Subtype.toString(), "Highlight");
      assert.equal(
        dictionary.CA ? dictionary.CA.toNumber() : 1,
        opacities[index] ?? 1,
      );
      assert.deepEqual(
        dictionary.C.toPDFArray()
          .toJSArray()
          .map(function (value) {
            return value.toNumber();
          }),
        [1, 1, 0],
      );
    });
  });

  it("links every comment and annot reply to its own parent dictionary", async function () {
    var recipe = new muhammara.Recipe("new", output).createPage(595, 842);
    var options = {
      title: "Review",
      replies: [
        { text: "Confirmed.", title: "Reviewer" },
        { text: "Ready to publish.", title: "Editor" },
      ],
    };
    recipe.comment("Please review.", 300, 100, options);
    recipe.annot(300, 200, "Text", { ...options, text: "Please review." });
    recipe.comment("No replies.", 300, 300);
    recipe.comment("Empty replies.", 300, 400, { replies: [] });
    var annotations = await finish(recipe);
    assert.equal(annotations.length, 8);
    [0, 3].forEach(function (index) {
      var parent = annotations[index];
      assert.equal(parent.dictionary.Contents.toText(), "Please review.");
      assert.equal(parent.dictionary.T.toText(), "Review");
      assert.equal(parent.dictionary.IRT, undefined);
      options.replies.forEach(function (reply, replyIndex) {
        var dictionary = annotations[index + replyIndex + 1].dictionary;
        assert.equal(dictionary.Subtype.toString(), "Text");
        assert.equal(dictionary.Contents.toText(), reply.text);
        assert.equal(dictionary.T.toText(), reply.title);
        assert.equal(
          dictionary.IRT.toPDFIndirectObjectReference().getObjectID(),
          parent.id,
        );
        assert.equal(dictionary.RT.toString(), "R");
      });
    });
    assert.equal(annotations[0].dictionary.Name.toString(), "Comment");
    assert.equal(annotations[6].dictionary.Contents.toText(), "No replies.");
    assert.equal(annotations[7].dictionary.Contents.toText(), "Empty replies.");
  });
});
