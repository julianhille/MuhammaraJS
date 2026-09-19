var assert = require("node:assert/strict");
var fs = require("node:fs");
var os = require("node:os");
var path = require("node:path");
var muhammara = require("@muhammara/native-with-source");

function readAnnotations(reader, pageIndex = 0) {
  var page = reader.parsePage(pageIndex).getDictionary();
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

function readPageContent(reader, pageIndex = 0) {
  var page = reader.parsePage(pageIndex).getDictionary();
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

/** Decodes the form streams that contain an edited page's drawn content. */
function readPageForms(reader, pageIndex = 0) {
  var page = reader.parsePage(pageIndex).getDictionary();
  var resources = reader
    .queryDictionaryObject(page, "Resources")
    .toPDFDictionary();
  var forms = reader
    .queryDictionaryObject(resources, "XObject")
    .toPDFDictionary()
    .toJSObject();
  return Object.values(forms)
    .map(function (reference) {
      var stream = reader
        .parseNewObject(reference.toPDFIndirectObjectReference().getObjectID())
        .toPDFStream();
      var input = reader.startReadingFromStream(stream);
      var bytes = [];
      while (input.notEnded()) bytes.push(...input.read(4096));
      return Buffer.from(bytes).toString("latin1");
    })
    .join("\n");
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

  it("rejects links between pages instead of queuing them on the next page", async function () {
    var recipe = new muhammara.Recipe("new", output)
      .createPage(595, 842)
      .endPage();
    assert.throws(function () {
      recipe.link("https://invalid.test", 50, 100, 80, 12);
    });
    recipe.createPage(595, 842).link("https://valid.test", 50, 100, 80, 12);
    await new Promise(function (resolve) {
      recipe.endPage().endPDF(resolve);
    });
    reader = muhammara.createReader(output);
    assert.equal(readAnnotations(reader, 1).length, 1);
  });

  [false, true].forEach(function (html) {
    [1, 0.5].forEach(function (opacity) {
      it(`covers each justified ${html ? "HTML" : "plain"} line with markup at opacity ${opacity}`, async function () {
        var recipe = new muhammara.Recipe("new", output).createPage(300, 300);
        var highlight = { text: "Check." };
        recipe.text("alpha beta gamma delta epsilon", 50, 50, {
          html,
          opacity,
          size: 14,
          highlight,
          textBox: { width: 120, padding: 10, textAlign: "justify" },
        });
        var annotations = await finish(recipe);
        assert.ok(annotations.length > 1);
        annotations.forEach(function (annotation, index) {
          var rect = annotation.dictionary.Rect.toPDFArray()
            .toJSArray()
            .map(function (value) {
              return value.toNumber();
            });
          assert.ok(Math.abs(rect[0] - 60) < 0.01);
          if (index < annotations.length - 1)
            assert.ok(Math.abs(rect[2] - rect[0] - 100) < 0.01);
        });
        assert.deepEqual(highlight, { text: "Check." });
      });
    });
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
    assert.match(readPageForms(reader), /Tj/);
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

  ["new", "added", "edited", "paused", "resumed"].forEach(function (mode) {
    it(`preserves structured markup on ${mode} source pages`, async function () {
      var source = path.join(directory, "source.pdf");
      await new Promise(function (resolve) {
        new muhammara.Recipe("new", source)
          .createPage(595, 842)
          .endPage()
          .endPDF(resolve);
      });
      var recipe = new muhammara.Recipe(
        mode === "new" ? "new" : source,
        output,
      );
      if (mode === "added" || mode === "new") recipe.createPage(595, 842);
      else recipe.editPage(1);
      recipe.text("Reviewed text.", 50, 100, {
        subject: "Review subject",
        date: new Date("2026-01-02T03:04:05Z"),
        title: "Reviewer",
        richText: true,
        squiggly: {
          text: "<p>Needs review.</p>",
          opacity: 0.4,
          replies: [{ text: "Confirmed.", title: "Editor" }],
        },
      });
      recipe.link("https://before.test", 50, 150, 80, 12);
      recipe.link("https://after.test", 50, 250, 80, 12);
      if (mode === "paused" || mode === "resumed") recipe.pauseContext();
      if (mode === "resumed")
        recipe.resumeContext().text("After resume.", 50, 300);
      recipe.comment("After pause.", 300, 200);
      await new Promise(function (resolve) {
        recipe.endPage().endPDF(resolve);
      });
      reader = muhammara.createReader(output);
      var pageIndex = mode === "added" ? 1 : 0;
      var annotations = readAnnotations(reader, pageIndex);
      var parent = annotations.find(function (annotation) {
        return annotation.dictionary.RC;
      });
      assert.equal(annotations.length, 5);
      assert.equal(parent.dictionary.Subj.toText(), "Review subject");
      assert.match(parent.dictionary.M.toText(), /^D:20260102/);
      assert.match(parent.dictionary.RC.toText(), /<p>Needs review\.<\/p>/);
      assert.equal(parent.dictionary.T.toText(), "Reviewer");
      assert.equal(parent.dictionary.CA.toNumber(), 0.4);
      var reply = annotations.find(function (annotation) {
        return annotation.dictionary.Contents?.toText() === "Confirmed.";
      });
      assert.equal(
        reply.dictionary.IRT.toPDFIndirectObjectReference().getObjectID(),
        parent.id,
      );
      assert.equal(reply.dictionary.RT.toString(), "R");
      assert.match(
        readPageContent(reader, pageIndex),
        mode === "added" || mode === "new" ? /Tj/ : /Do/,
      );
      if (mode === "edited" || mode === "paused" || mode === "resumed")
        assert.match(readPageForms(reader), /Tj/);
      if (mode === "resumed")
        assert.equal((readPageForms(reader).match(/Tj/g) || []).length, 2);
    });
  });
});
