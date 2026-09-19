import assert from "node:assert/strict";
import { createMuhammaraWasm, createRecipe } from "../../index.js";

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

function readPageContent(muhammara, reader, pageIndex = 0) {
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
      return new TextDecoder("latin1").decode(new Uint8Array(bytes));
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
      return new TextDecoder("latin1").decode(new Uint8Array(bytes));
    })
    .join("\n");
}

describe("Recipe annotation parity", function () {
  var Recipe;
  var muhammara;
  var reader;

  before(async function () {
    Recipe = await createRecipe();
    muhammara = await createMuhammaraWasm();
  });

  afterEach(function () {
    if (reader) reader.end();
    reader = undefined;
  });

  function finish(recipe) {
    reader = muhammara.createReader(recipe.endPage().endPDF());
    return readAnnotations(reader);
  }

  it("writes fractional and zero opacity while keeping the opaque default", function () {
    var recipe = new Recipe().createPage(595, 842);
    var opacities = [0.45, 0, 1, undefined];
    opacities.forEach(function (opacity, index) {
      recipe.annot(100, 200 + index * 30, "Highlight", {
        width: 200,
        height: 14,
        color: "#ffff00",
        opacity: opacity,
      });
    });
    var annotations = finish(recipe);
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

  it("links every comment and annot reply to its own parent dictionary", function () {
    var recipe = new Recipe().createPage(595, 842);
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
    var annotations = finish(recipe);
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

  it("inherits parent metadata for replies without their own", function () {
    var recipe = new Recipe().createPage(595, 842);
    recipe.comment("Please review.", 50, 50, {
      title: "Reviewer",
      flag: "print",
      open: true,
      replies: [
        { text: "Inherited." },
        { text: "Override.", title: "Editor", flag: "hidden" },
      ],
    });
    var annotations = finish(recipe);
    var inherited = annotations[1].dictionary;
    var overridden = annotations[2].dictionary;
    assert.equal(inherited.T.toText(), "Reviewer");
    assert.equal(inherited.F.toNumber(), 4);
    assert.equal(inherited.Open.toPDFBoolean().value, true);
    assert.equal(overridden.T.toText(), "Editor");
    assert.equal(overridden.F.toNumber(), 2);
  });

  it("writes squiggly text markup options", function () {
    var recipe = new Recipe().createPage(595, 842);
    recipe.text("Review this text.", 50, 100, {
      squiggly: {
        text: "Needs review.",
        color: [255, 0, 0],
        opacity: 0.4,
        replies: [{ text: "Confirmed.", title: "Reviewer", opacity: 0.2 }],
      },
    });

    var annotations = finish(recipe);
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

  it("rejects links between pages instead of queuing them on the next page", function () {
    var recipe = new Recipe().createPage(595, 842).endPage();
    assert.throws(function () {
      recipe.link("https://invalid.test", 50, 100, 80, 12);
    });
    recipe.createPage(595, 842).link("https://valid.test", 50, 100, 80, 12);
    reader = muhammara.createReader(recipe.endPage().endPDF());
    assert.equal(readAnnotations(reader, 1).length, 1);
  });

  [false, true].forEach(function (html) {
    [1, 0.5].forEach(function (opacity) {
      it(`covers each justified ${html ? "HTML" : "plain"} line with markup at opacity ${opacity}`, function () {
        var recipe = new Recipe().createPage(300, 300);
        var highlight = { text: "Check." };
        recipe.text("alpha beta gamma delta epsilon", 50, 50, {
          html,
          opacity,
          size: 14,
          highlight,
          textBox: { width: 120, padding: 10, textAlign: "justify" },
        });
        var annotations = finish(recipe);
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

  it("adds text markup only for requested options", function () {
    var recipe = new Recipe().createPage(595, 842);
    recipe.text("Marked text.", 50, 100, {
      highlight: true,
      underline: { text: "Underlined." },
      strikeOut: true,
      squiggly: false,
      title: "Reviewer",
    });
    recipe.text("Plain text.", 50, 200, { underline: false, highlight: false });
    recipe.text("<u>Decorated</u> <s>only</s>.", 50, 300, {
      html: true,
      size: 14,
      textBox: { width: 300 },
    });

    var annotations = finish(recipe);
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

  it("keeps the page content readable when annotations share the page", function () {
    var recipe = new Recipe().createPage(595, 842);
    recipe.text("Commented text.", 50, 100, { highlight: true });
    recipe.comment("Please review.", 300, 100);
    recipe.link("https://example.test", 50, 150, 80, 12);
    recipe.text("Linked text.", 50, 180, { link: "https://text.test" });
    var source = recipe.endPage().endPDF();
    reader = muhammara.createReader(source);
    assert.match(readPageContent(muhammara, reader), /Linked text[\s\S]*Q\s*$/);
    assert.deepEqual(subtypes(readAnnotations(reader)), [
      "Link",
      "Link",
      "Highlight",
      "Text",
    ]);
    reader.end();

    var edited = new Recipe(source);
    edited
      .editPage(1)
      .text("Edited text.", 50, 200, { underline: true, strikeOut: true })
      .link("https://edited.test", 50, 220, 80, 12);
    reader = muhammara.createReader(edited.endPage().endPDF());
    // Edited content is drawn through a form XObject the page invokes.
    assert.match(readPageContent(muhammara, reader), /Commented text[\s\S]*Do/);
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
    it(`preserves structured markup on ${mode} source pages`, function () {
      var source = new Recipe().createPage(595, 842).endPage().endPDF();
      var recipe = mode === "new" ? new Recipe() : new Recipe(source);
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
      reader = muhammara.createReader(recipe.endPage().endPDF());
      var pageIndex = mode === "added" ? 1 : 0;
      var annotations = readAnnotations(reader, pageIndex);
      var parent = annotations.find(function (annotation) {
        return annotation.dictionary.RC;
      });
      assert.equal(annotations.length, 5);
      assert.equal(parent.dictionary.Subj.toText(), "Review subject");
      assert.match(parent.dictionary.M.toText(), /^D:20260102030405/);
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
      var content = readPageContent(muhammara, reader, pageIndex);
      assert.match(content, mode === "added" || mode === "new" ? /Tj/ : /Do/);
      if (mode === "edited" || mode === "paused" || mode === "resumed")
        assert.match(readPageForms(reader), /Tj/);
      if (mode === "resumed")
        assert.equal((readPageForms(reader).match(/Tj/g) || []).length, 2);
    });
  });

  it("rejects invalid annotation values alike on new and edited pages", function () {
    var source = new Recipe().createPage(595, 842).endPage().endPDF();
    [
      { opacity: 2 },
      { borderDash: ["x"] },
      { quadPoints: [1, 2, 3] },
      { borderWidth: Number.NaN },
    ].forEach(function (options) {
      [
        new Recipe().createPage(595, 842),
        new Recipe(source).editPage(1),
      ].forEach(function (recipe) {
        recipe.annot(50, 50, "Square", { width: 10, height: 10, ...options });
        assert.throws(() => recipe.endPage(), {
          name: "TypeError",
          message: "Invalid annotation options",
        });
      });
    });
  });

  it("writes non-ASCII annotation text and supplied rich text", function () {
    var source = new Recipe().createPage(595, 842).endPage().endPDF();
    var xml = '<?xml version="1.0"?><body><p>Supplied.</p></body>';
    ["new", "edited"].forEach(function (mode) {
      var recipe =
        mode === "new"
          ? new Recipe().createPage(595, 842)
          : new Recipe(source).editPage(1);
      recipe
        .comment("Größe ✓", 50, 50, { title: "Jürgen", subject: "Prüfung" })
        .comment(xml, 50, 100, { richText: true });
      reader = muhammara.createReader(recipe.endPage().endPDF());
      var annotations = readAnnotations(reader);
      assert.equal(annotations[0].dictionary.Contents.toText(), "Größe ✓");
      assert.equal(annotations[0].dictionary.T.toText(), "Jürgen");
      assert.equal(annotations[0].dictionary.Subj.toText(), "Prüfung");
      assert.equal(annotations[1].dictionary.RC.toText(), xml);
      reader.end();
    });
  });
});
