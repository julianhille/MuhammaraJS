import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm, createRecipe } from "../../index.js";
import { writeOutput } from "../testOutput.mjs";

/** Reads the shared Arial fixture so both ends measure text identically. */
async function arialBytes() {
  return new Uint8Array(
    await readFile(
      new URL(
        "../../../native-with-source/tests/TestMaterials/fonts/arial.ttf",
        import.meta.url,
      ),
    ),
  );
}

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

  function finish(recipe, outputName) {
    var bytes = recipe.endPage().endPDF();
    if (outputName) writeOutput(outputName, bytes);
    reader = muhammara.createReader(bytes);
    return readAnnotations(reader);
  }

  ["new", "edited"].forEach(function (mode) {
    [false, true].forEach(function (html) {
      it(`clips ${html ? "HTML" : "plain"} text markup to the box on ${mode} pages`, function () {
        var source = new Recipe().createPage(300, 300).endPage().endPDF();
        var recipe =
          mode === "new"
            ? new Recipe().createPage(300, 300)
            : new Recipe(source).editPage(1);
        ["left", "center", "right"].forEach(function (alignment, index) {
          recipe.text(
            "This sentence is much wider than the clipped text box.",
            50,
            40 + index * 70,
            {
              size: 14,
              html,
              opacity: index === 1 ? 0.5 : 1,
              highlight: true,
              squiggly: true,
              textBox: {
                width: 100,
                height: 24,
                lineHeight: 24,
                wrap: "clip",
                textAlign: `${alignment} top`,
              },
            },
          );
        });
        var annotations = finish(recipe);
        assert.equal(annotations.length, 6);
        annotations.forEach(function (annotation, index) {
          var top = 300 - (40 + Math.floor(index / 2) * 70);
          var bottom = top - 24;
          var rect = annotation.dictionary.Rect.toPDFArray()
            .toJSArray()
            .map(function (value) {
              return value.toNumber();
            });
          assert.ok(
            rect[0] >= 49.99 && rect[2] <= 150.01 && rect[2] > rect[0],
            `horizontal bounds: ${rect}`,
          );
          assert.ok(
            rect[1] >= bottom - 0.01 && rect[3] <= top + 0.01,
            `vertical bounds: ${rect}`,
          );
          annotation.dictionary.QuadPoints.toPDFArray()
            .toJSArray()
            .forEach(function (value, coordinate) {
              var number = value.toNumber();
              assert.ok(
                coordinate % 2
                  ? number >= bottom - 0.01 && number <= top + 0.01
                  : number >= 49.99 && number <= 150.01,
              );
            });
        });
      });
    });
  });

  ["new", "edited"].forEach(function (mode) {
    [false, true].forEach(function (html) {
      it(`clips ${html ? "HTML" : "plain"} text links to the box on ${mode} pages`, function () {
        var source = new Recipe().createPage(300, 300).endPage().endPDF();
        var recipe =
          mode === "new"
            ? new Recipe().createPage(300, 300)
            : new Recipe(source).editPage(1);
        ["left", "center", "right"].forEach(function (alignment, index) {
          recipe.text(
            "OverlongClickableWordWithoutSpaces".repeat(3),
            50,
            40 + index * 70,
            {
              size: 14,
              html,
              opacity: index === 1 ? 0.5 : 1,
              link: `https://example.test/${index}`,
              textBox: {
                width: 100,
                height: 24,
                lineHeight: 24,
                wrap: "clip",
                textAlign: `${alignment} top`,
              },
            },
          );
        });
        var annotations = finish(recipe);
        assert.deepEqual(
          annotations.map(function (annotation) {
            return annotation.dictionary.Subtype.toString();
          }),
          ["Link", "Link", "Link"],
        );
        annotations.forEach(function (annotation, index) {
          var top = 300 - (40 + index * 70);
          var rect = annotation.dictionary.Rect.toPDFArray()
            .toJSArray()
            .map(function (value) {
              return value.toNumber();
            });
          assert.ok(
            rect[0] >= 49.99 && rect[2] <= 150.01 && rect[2] > rect[0],
            `horizontal bounds: ${rect}`,
          );
          assert.ok(
            rect[1] >= top - 24.01 && rect[3] <= top + 0.01,
            `vertical bounds: ${rect}`,
          );
        });
      });
    });
  });

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

  it("adds FreeText annotations at fixed and centered coordinates", function () {
    var recipe = new Recipe().createPage(612, 792);
    recipe
      .annot(300, 300, "FreeText", { text: "Yo yo yo" })
      .annot("center", "center", "FreeText", {
        text: "Do you have Free Style yo?",
        width: 200,
        height: 50,
      });
    var annotations = finish(recipe);
    assert.deepEqual(subtypes(annotations), ["FreeText", "FreeText"]);
    assert.equal(annotations[0].dictionary.Contents.toText(), "Yo yo yo");
    assert.equal(
      annotations[1].dictionary.Contents.toText(),
      "Do you have Free Style yo?",
    );
    var centeredRect = annotations[1].dictionary.Rect.toPDFArray()
      .toJSArray()
      .map(function (value) {
        return value.toNumber();
      });
    assert.equal(centeredRect[2] - centeredRect[0], 200);
    assert.equal(centeredRect[3] - centeredRect[1], 50);
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
      { width: Number.NaN },
      { height: Number.NaN },
    ].forEach(function (options) {
      [
        new Recipe().createPage(595, 842),
        new Recipe(source).editPage(1),
      ].forEach(function (recipe, index) {
        recipe.text("Keep this content.", 50, 30);
        recipe.comment("Valid.", 50, 80);
        // Invalid options throw at the call and never enter the queue, so
        // the page still ends with its content and valid annotations.
        assert.throws(
          () =>
            recipe.annot(50, 50, "Square", {
              width: 10,
              height: 10,
              ...options,
            }),
          { name: "TypeError", message: "Invalid annotation options" },
        );
        reader = muhammara.createReader(recipe.endPage().endPDF());
        assert.deepEqual(subtypes(readAnnotations(reader)), ["Text"]);
        assert.match(
          index === 0
            ? readPageContent(muhammara, reader)
            : readPageForms(reader),
          /Tj/,
        );
        reader.end();
        reader = undefined;
      });
    });
  });

  it("rejects invalid text markup before drawing or queuing annotations", function () {
    var source = new Recipe().createPage(595, 842).endPage().endPDF();
    ["new", "edited"].forEach(function (mode) {
      var recipe =
        mode === "new"
          ? new Recipe().createPage(595, 842)
          : new Recipe(source).editPage(1);
      recipe.text("Keep this content.", 50, 30);
      recipe.comment("Valid.", 50, 80);
      var position = recipe.position;
      assert.throws(
        function () {
          recipe.text("Do not draw this text.", 50, 50, {
            highlight: true,
            underline: { opacity: 2 },
          });
        },
        { name: "TypeError", message: "Invalid annotation options" },
      );
      assert.deepEqual(recipe.position, position);
      reader = muhammara.createReader(recipe.endPage().endPDF());
      assert.deepEqual(subtypes(readAnnotations(reader)), ["Text"]);
      var content =
        mode === "new"
          ? readPageContent(muhammara, reader)
          : readPageForms(reader);
      assert.equal((content.match(/Tj/g) || []).length, 1);
      reader.end();
      reader = undefined;
    });
  });

  ["new", "edited"].forEach(function (mode) {
    it(`inherits parent metadata for replies on ${mode} pages`, function () {
      var source = new Recipe().createPage(595, 842).endPage().endPDF();
      var recipe =
        mode === "new"
          ? new Recipe().createPage(595, 842)
          : new Recipe(source).editPage(1);
      recipe.comment("Parent.", 50, 50, {
        title: "Reviewer",
        subject: "Review subject",
        date: new Date("2026-09-19T12:00:00Z"),
        flag: "print",
        open: true,
        opacity: 0.4,
        richText: true,
        replies: [
          { text: "Inherited." },
          {
            text: "Override.",
            title: "Editor",
            subject: "Other",
            flag: "hidden",
          },
        ],
      });
      var annotations = finish(recipe);
      var parent = annotations[0].dictionary;
      var inherited = annotations[1].dictionary;
      var overridden = annotations[2].dictionary;
      assert.equal(inherited.T.toText(), "Reviewer");
      assert.equal(inherited.Subj.toText(), "Review subject");
      assert.equal(inherited.M.toText(), parent.M.toText());
      assert.equal(inherited.F.toNumber(), 4);
      assert.equal(inherited.Name.toString(), "Comment");
      assert.equal(inherited.Open.toPDFBoolean().value, true);
      assert.equal(inherited.Contents.toText(), "Inherited.");
      assert.equal(inherited.RC, undefined);
      assert.equal(inherited.CA?.toNumber() ?? 1, 1);
      assert.equal(overridden.T.toText(), "Editor");
      assert.equal(overridden.Subj.toText(), "Other");
      assert.equal(overridden.F.toNumber(), 2);
    });
  });

  it("writes the same valid dashed border on new and edited pages", function () {
    var source = new Recipe().createPage(595, 842).endPage().endPDF();
    ["new", "edited"].forEach(function (mode) {
      var recipe =
        mode === "new"
          ? new Recipe().createPage(595, 842)
          : new Recipe(source).editPage(1);
      recipe.text("Review border.", 50, 30);
      recipe.annot(50, 50, "Square", {
        width: 100,
        height: 20,
        border: { width: 2, dash: [3, 4] },
      });
      var annotation = finish(recipe)[0].dictionary;
      var border = annotation.Border.toPDFArray().toJSArray();
      assert.equal(border.length, 4);
      assert.deepEqual(
        border.slice(0, 3).map(function (value) {
          return value.toNumber();
        }),
        [0, 0, 2],
      );
      assert.deepEqual(
        border[3]
          .toPDFArray()
          .toJSArray()
          .map(function (value) {
            return value.toNumber();
          }),
        [3, 4],
      );
      reader.end();
      reader = undefined;
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

  it("converts annotation text like native and inherits empty reply flags", function () {
    var recipe = new Recipe().createPage(595, 842);
    recipe.comment("Parent.", 50, 50, {
      title: null,
      subject: 42,
      flag: "print",
      replies: [{ text: 7, flag: "" }],
    });
    recipe.text("Marked.", 50, 100, { highlight: { text: null } });
    var annotations = finish(recipe);
    assert.equal(annotations[0].dictionary.T?.toText() ?? "", "");
    assert.equal(annotations[0].dictionary.Subj.toText(), "42");
    assert.equal(annotations[1].dictionary.Contents.toText(), "7");
    assert.equal(annotations[1].dictionary.F.toNumber(), 4);
    assert.equal(annotations[2].dictionary.Subtype.toString(), "Highlight");
    assert.equal(annotations[2].dictionary.Contents?.toText() ?? "", "");
  });

  ["new", "edited"].forEach(function (mode) {
    it(`preserves zero and false annotation metadata on ${mode} pages`, function () {
      var source = new Recipe().createPage(595, 842).endPage().endPDF();
      var recipe =
        mode === "new"
          ? new Recipe().createPage(595, 842)
          : new Recipe(source).editPage(1);
      recipe.comment("Parent.", 50, 50, {
        title: 0,
        subject: false,
        replies: [{ text: "Reply." }],
      });
      recipe.comment("Other.", 50, 100, { title: false, subject: 0 });
      var annotations = finish(recipe);
      [0, 1].forEach(function (index) {
        assert.equal(annotations[index].dictionary.T?.toText(), "0");
        assert.equal(annotations[index].dictionary.Subj?.toText(), "false");
      });
      assert.equal(annotations[2].dictionary.T?.toText(), "false");
      assert.equal(annotations[2].dictionary.Subj?.toText(), "0");
    });

    it(`rejects unsupported URLs before queuing links on ${mode} pages`, function () {
      var source = new Recipe().createPage(595, 842).endPage().endPDF();
      var recipe =
        mode === "new"
          ? new Recipe().createPage(595, 842)
          : new Recipe(source).editPage(1);
      recipe.text("Keep this content.", 50, 30);
      recipe.link("https://valid.test", 50, 50, 80, 12);
      [42, "https://example.test/✓"].forEach(function (url) {
        assert.throws(function () {
          recipe.link(url, 50, 80, 80, 12);
        });
      });
      recipe.link(encodeURI("https://example.test/✓"), 50, 110, 80, 12);
      var annotations = finish(recipe);
      assert.deepEqual(subtypes(annotations), ["Link", "Link"]);
      var content =
        mode === "new"
          ? readPageContent(muhammara, reader)
          : readPageForms(reader);
      assert.match(content, /Tj/);
    });
  });

  ["new", "added", "edited"].forEach(function (mode) {
    it(`rejects invalid link rectangles before queuing on ${mode} pages`, function () {
      var source = new Recipe().createPage(595, 842).endPage().endPDF();
      var recipe = mode === "new" ? new Recipe() : new Recipe(source);
      if (mode === "edited") recipe.editPage(1);
      else recipe.createPage(595, 842);
      recipe.text("Before rejected links.", 50, 30);
      recipe.link("https://before.test", 50, 50, 80, 12);
      [
        [Number.NaN, 50, 80, 12],
        [50, Number.POSITIVE_INFINITY, 80, 12],
        [50, 50, Number.NaN, 12],
        [50, 50, 80, Number.NaN],
        [50, 50, Number.POSITIVE_INFINITY, 12],
        [Number.MAX_VALUE, 50, Number.MAX_VALUE, 12],
      ].forEach(function (rectangle) {
        assert.throws(
          function () {
            recipe.link("https://invalid.test", ...rectangle);
          },
          {
            name: "TypeError",
            message: "URL link requires a URL and valid PDF rectangle",
          },
        );
      });
      recipe.text("After rejected links.", 50, 80);
      recipe.link("https://after.test", 50, 100, 80, 12);
      // Zero-sized rectangles remain valid, as in the low-level writer API.
      recipe.link("https://empty.test", 50, 120, 0, 0);
      reader = muhammara.createReader(recipe.endPage().endPDF());
      var pageIndex = mode === "added" ? 1 : 0;
      var annotations = readAnnotations(reader, pageIndex);
      assert.deepEqual(subtypes(annotations), ["Link", "Link", "Link"]);
      annotations.forEach(function (annotation) {
        annotation.dictionary.Rect.toPDFArray()
          .toJSArray()
          .forEach(function (value) {
            assert.ok(Number.isFinite(value.toNumber()));
          });
      });
      var content =
        mode === "edited"
          ? readPageForms(reader)
          : readPageContent(muhammara, reader, pageIndex);
      assert.equal((content.match(/Tj/g) || []).length, 2);
    });
  });

  ["new", "edited"].forEach(function (mode) {
    it(`keeps negative link sizes over the same area on ${mode} pages`, function () {
      var source = new Recipe().createPage(595, 842).endPage().endPDF();
      var recipe =
        mode === "new"
          ? new Recipe().createPage(595, 842)
          : new Recipe(source).editPage(1);
      recipe.link("https://negative.test", 100, 150, -40, -10);
      recipe.rectangle(100, 200, -50, 20, { link: "https://shape.test" });
      assert.deepEqual(
        finish(recipe).map(function (annotation) {
          var [left, bottom, right, top] =
            annotation.dictionary.Rect.toPDFArray()
              .toJSArray()
              .map(function (value) {
                return value.toNumber();
              });
          return [Math.abs(right - left), Math.abs(top - bottom)];
        }),
        [
          [40, 10],
          [50, 20],
        ],
      );
    });
  });
  ["new", "edited"].forEach(function (mode) {
    it(`defaults markup borders to zero width and omits empty rich text on ${mode} pages`, function () {
      var source = new Recipe().createPage(595, 842).endPage().endPDF();
      var recipe =
        mode === "new"
          ? new Recipe().createPage(595, 842)
          : new Recipe(source).editPage(1);
      recipe.text("Marked.", 50, 100, { highlight: true });
      recipe.annot(50, 150, "Square", { width: 20, height: 20 });
      recipe.comment("", 50, 200, { richText: true });
      var annotations = finish(recipe);
      assert.deepEqual(
        annotations[0].dictionary.Border.toPDFArray()
          .toJSArray()
          .map(function (value) {
            return value.toNumber();
          }),
        [0, 0, 0],
      );
      assert.equal(annotations[1].dictionary.Border, undefined);
      assert.equal(annotations[2].dictionary.RC, undefined);
      assert.equal(annotations[2].dictionary.Contents, undefined);
    });
  });

  it("places text markup annotations from text options like native", async function () {
    Recipe.registerFont("arial", await arialBytes());
    var recipe = new Recipe().createPage(400, 400);
    recipe
      .text("Hello", 50, 100, { font: "arial", underline: true })
      .text("Hello", 50, 150, {
        font: "arial",
        strikeOut: { color: "#0000ff", text: "cut" },
        title: "Editor",
      })
      .text("Hello", 50, 200, { font: "arial", highlight: true });
    var annotations = finish(recipe, "text-markup-annotations");
    /** Reads a numeric PDF array from an annotation dictionary. */
    var numbers = (value) =>
      value
        .toPDFArray()
        .toJSArray()
        .map((item) => Number(item.toNumber().toFixed(3)));
    assert.deepEqual(
      annotations.map(({ dictionary }) => ({
        subtype: dictionary.Subtype.toString(),
        color: numbers(dictionary.C),
        rect: numbers(dictionary.Rect),
        quadPoints: numbers(dictionary.QuadPoints),
      })),
      [
        {
          subtype: "Underline",
          color: [0, 1, 0],
          rect: [50, 284.242, 81.374, 302.626],
          quadPoints: [50, 303, 81, 303, 50, 284, 81, 284],
        },
        {
          subtype: "StrikeOut",
          color: [0, 0, 1],
          rect: [50, 234.242, 81.374, 252.626],
          quadPoints: [50, 253, 81, 253, 50, 234, 81, 234],
        },
        {
          subtype: "Highlight",
          color: [1, 1, 0],
          rect: [50, 184.242, 81.374, 202.626],
          quadPoints: [50, 203, 81, 203, 50, 184, 81, 184],
        },
      ],
    );
    assert.equal(annotations[1].dictionary.Contents.toText(), "cut");
    assert.equal(annotations[1].dictionary.T.toText(), "Editor");
  });

  it("draws HTML underline and del as text-colored lines, not annotations", async function () {
    Recipe.registerFont("arial", await arialBytes());
    var recipe = new Recipe().createPage(400, 400);
    recipe
      .text("<u>Hello</u>", 50, 100, { font: "arial", html: true })
      .text("<del>Hello</del>", 50, 150, {
        font: "arial",
        html: true,
        color: "#ff0000",
      });
    var bytes = recipe.endPage().endPDF();
    writeOutput("html-underline-strikeout-lines", bytes);
    reader = muhammara.createReader(bytes);
    var page = reader.parsePage(0).getDictionary();
    assert.equal(page.exists("Annots"), false, "HTML markup is not annotated");
    var content = (function () {
      var input = reader.startReadingFromStream(
        reader.queryDictionaryObject(page, "Contents").toPDFStream(),
      );
      var bytes = [];
      while (input.notEnded()) bytes.push(...input.read(4096));
      return new TextDecoder("latin1").decode(new Uint8Array(bytes));
    })();
    var baselines = Array.from(
      content.matchAll(/1 0 0 1 50 ([\d.]+) Tm/g),
      (match) => Number(match[1]),
    );
    var lines = Array.from(
      content.matchAll(/([\d.]+) ([\d.]+) m\s+([\d.]+) ([\d.]+) l/g),
      (match) => match.slice(1).map(Number),
    );
    // Underline sits 0.1 and strike-out 0.2 text heights (13.132pt) from the baseline.
    assert.deepEqual(
      lines.map((line) => line.map((value) => Number(value.toFixed(3)))),
      [
        [
          50,
          Number((baselines[0] - 1.3132).toFixed(3)),
          81.374,
          Number((baselines[0] - 1.3132).toFixed(3)),
        ],
        [
          50,
          Number((baselines[1] + 2.6264).toFixed(3)),
          81.374,
          Number((baselines[1] + 2.6264).toFixed(3)),
        ],
      ],
    );
    assert.match(content, /\b2 w\b/, "lines are 2pt wide");
    assert.match(
      content,
      /0\.090196 0\.466667 0\.819608 RG/,
      "default text color",
    );
    assert.match(
      content,
      /(^|\s)1 0 0 RG\b/,
      "the del line uses the text color",
    );
  });
});
