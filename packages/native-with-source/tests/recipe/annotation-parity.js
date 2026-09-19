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

  ["new", "edited"].forEach(function (mode) {
    [false, true].forEach(function (html) {
      it(`clips ${html ? "HTML" : "plain"} text links to the box on ${mode} pages`, async function () {
        var source = path.join(directory, "source.pdf");
        await new Promise(function (resolve) {
          new muhammara.Recipe("new", source)
            .createPage(300, 300)
            .endPage()
            .endPDF(resolve);
        });
        var recipe = new muhammara.Recipe(
          mode === "new" ? "new" : source,
          output,
        );
        if (mode === "new") recipe.createPage(300, 300);
        else recipe.editPage(1);
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
        var annotations = await finish(recipe);
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

  it("keeps text links on their page across overflow callbacks", async function () {
    var recipe = new muhammara.Recipe("new", output).createPage(200, 200);
    var overflows = 0;
    recipe
      .layout("links", 20, 20, 100, 24, { columns: 1 })
      .text("First\nSecond\nThird", {
        size: 14,
        layout: "links",
        flow: false,
        link: "https://example.test",
        textBox: { lineHeight: 24 },
        overflow: function (currentRecipe) {
          overflows++;
          currentRecipe.endPage().createPage(200, 200);
          return { column: 0 };
        },
      });
    await new Promise(function (resolve) {
      recipe.endPage().endPDF(resolve);
    });
    reader = muhammara.createReader(output);
    assert.equal(overflows, 2);
    assert.equal(reader.getPagesCount(), 3);
    for (var index = 0; index < 3; index++) {
      assert.deepEqual(
        readAnnotations(reader, index).map(function (annotation) {
          return annotation.dictionary.Subtype.toString();
        }),
        ["Link"],
      );
    }
  });

  it("writes text links before onClip ends the page", async function () {
    var recipe = new muhammara.Recipe("new", output).createPage(200, 200);
    var clipped = false;
    recipe.text("First\nSecond", 20, 20, {
      size: 14,
      link: "https://example.test",
      textBox: {
        width: 100,
        height: 24,
        lineHeight: 24,
        clipIfExceedsBox: true,
        onClip: function (currentRecipe) {
          clipped = true;
          currentRecipe.endPage();
        },
      },
    });
    await new Promise(function (resolve) {
      recipe.endPDF(resolve);
    });
    reader = muhammara.createReader(output);
    assert.equal(clipped, true);
    assert.deepEqual(
      readAnnotations(reader).map(function (annotation) {
        return annotation.dictionary.Subtype.toString();
      }),
      ["Link"],
    );
  });

  it("retains edited content when linked text overflows on the same page", async function () {
    var source = path.join(directory, "source.pdf");
    await new Promise(function (resolve) {
      new muhammara.Recipe("new", source)
        .createPage(300, 300)
        .endPage()
        .endPDF(resolve);
    });
    var recipe = new muhammara.Recipe(source, output).editPage(1);
    var overflows = 0;
    recipe
      .layout("links", 20, 20, 100, 24, { columns: 1 })
      .text("First\nSecond\nThird", {
        size: 14,
        layout: "links",
        flow: false,
        link: "https://example.test",
        textBox: { lineHeight: 24 },
        overflow: function () {
          overflows++;
          return { column: [20, 20 + overflows * 50] };
        },
      });
    var annotations = await finish(recipe);
    assert.equal(overflows, 2);
    assert.equal(reader.getPagesCount(), 1);
    assert.deepEqual(
      annotations.map(function (annotation) {
        return annotation.dictionary.Subtype.toString();
      }),
      ["Link", "Link", "Link"],
    );
  });

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
});
