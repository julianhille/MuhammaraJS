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

function readPageContent(reader) {
  var page = reader.parsePage(0).getDictionary();
  var contents = reader.queryDictionaryObject(page, "Contents");
  var streams =
    contents.getType() === muhammara.ePDFObjectArray
      ? contents
          .toPDFArray()
          .toJSArray()
          .map(function (reference) {
            return reader.parseNewObject(
              reference.toPDFIndirectObjectReference().getObjectID(),
            );
          })
      : [contents];
  return streams
    .map(function (stream) {
      var input = reader.startReadingFromStream(stream.toPDFStream());
      var bytes = [];
      while (input.notEnded()) bytes.push(...input.read(4096));
      return Buffer.from(bytes).toString("latin1");
    })
    .join("\n");
}

function subtypes(annotations) {
  return annotations.map(function (annotation) {
    return annotation.dictionary.Subtype.toString();
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
        { text: "Confirmed.", title: "Reviewer", opacity: 0.35 },
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
          dictionary.CA ? dictionary.CA.toNumber() : 1,
          reply.opacity ?? 1,
        );
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

  it("writes squiggly text markup options", async function () {
    var recipe = new muhammara.Recipe("new", output).createPage(595, 842);
    recipe.text("Review this text.", 50, 100, {
      squiggly: {
        text: "Needs review.",
        color: [255, 0, 0],
        opacity: 0.4,
        replies: [{ text: "Confirmed.", title: "Reviewer", opacity: 0.2 }],
      },
    });

    var annotations = await finish(recipe);
    assert.equal(annotations.length, 2);
    assert.equal(annotations[0].dictionary.Subtype.toString(), "Squiggly");
    assert.equal(annotations[0].dictionary.Contents.toText(), "Needs review.");
    assert.equal(annotations[0].dictionary.CA.toNumber(), 0.4);
    assert.deepEqual(
      annotations[0].dictionary.C.toPDFArray()
        .toJSArray()
        .map(function (value) {
          return value.toNumber();
        }),
      [1, 0, 0],
    );
    assert.equal(annotations[1].dictionary.Contents.toText(), "Confirmed.");
    assert.equal(annotations[1].dictionary.T.toText(), "Reviewer");
    assert.equal(annotations[1].dictionary.CA.toNumber(), 0.2);
    assert.equal(
      annotations[1].dictionary.IRT.toPDFIndirectObjectReference().getObjectID(),
      annotations[0].id,
    );
  });

  it("adds text markup only for requested options", async function () {
    var recipe = new muhammara.Recipe("new", output).createPage(595, 842);
    recipe.text("Marked text.", 50, 100, {
      highlight: true,
      underline: { text: "Underlined." },
      strikeOut: true,
      squiggly: false,
      title: "Reviewer",
    });
    recipe.text("Plain text.", 50, 200, { underline: false, highlight: false });
    recipe.registerFont(
      "arial",
      path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
    );
    recipe.text("<u>Decorated</u> <s>only</s>.", 50, 300, {
      font: "arial",
      html: true,
      size: 14,
      textBox: { width: 300 },
    });

    var annotations = await finish(recipe);
    assert.deepEqual(subtypes(annotations), [
      "Highlight",
      "Underline",
      "StrikeOut",
    ]);
    annotations.forEach(function (annotation) {
      assert.equal(annotation.dictionary.T.toText(), "Reviewer");
      assert.equal(
        annotation.dictionary.QuadPoints.toPDFArray().getLength(),
        8,
      );
    });
    assert.equal(annotations[1].dictionary.Contents.toText(), "Underlined.");
  });

  it("keeps the page content readable when annotations share the page", async function () {
    var recipe = new muhammara.Recipe("new", output).createPage(595, 842);
    recipe.text("Commented text.", 50, 100, { highlight: true });
    recipe.comment("Please review.", 300, 100);
    recipe.link("https://example.test", 50, 150, 80, 12);
    recipe.text("Linked text.", 50, 180, { link: "https://text.test" });
    await finish(recipe);
    assert.match(readPageContent(reader), /Tj[\s\S]*Q\s*$/);
    assert.deepEqual(subtypes(readAnnotations(reader)), [
      "Link",
      "Link",
      "Highlight",
      "Text",
    ]);
    reader.end();
    reader = undefined;

    var edited = path.join(directory, "edited.pdf");
    var editor = new muhammara.Recipe(output, edited);
    editor
      .editPage(1)
      .text("Edited text.", 50, 200, { underline: true, strikeOut: true })
      .link("https://edited.test", 50, 220, 80, 12);
    await new Promise(function (resolve) {
      editor.endPage().endPDF(resolve);
    });
    reader = muhammara.createReader(edited);
    assert.match(readPageContent(reader), /Commented text/);
    assert.deepEqual(subtypes(readAnnotations(reader)), [
      "Link",
      "Link",
      "Highlight",
      "Text",
      "Link",
      "Underline",
      "StrikeOut",
    ]);
  });
});
