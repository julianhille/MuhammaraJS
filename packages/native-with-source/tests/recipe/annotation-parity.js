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

  it("places text markup annotations from text options like native", async function () {
    var recipe = new muhammara.Recipe("new", output);
    recipe.registerFont(
      "arial",
      path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
    );
    recipe.createPage(400, 400);
    recipe
      .text("Hello", 50, 100, { font: "arial", underline: true })
      .text("Hello", 50, 150, {
        font: "arial",
        strikeOut: { color: "#0000ff", text: "cut" },
        title: "Editor",
      })
      .text("Hello", 50, 200, { font: "arial", highlight: true });
    var annotations = await finish(recipe);
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
    var recipe = new muhammara.Recipe("new", output);
    recipe.registerFont(
      "arial",
      path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
    );
    recipe.createPage(400, 400);
    recipe
      .text("<u>Hello</u>", 50, 100, { font: "arial", html: true })
      .text("<del>Hello</del>", 50, 150, {
        font: "arial",
        html: true,
        color: "#ff0000",
      });
    await new Promise(function (resolve) {
      recipe.endPage().endPDF(resolve);
    });
    reader = muhammara.createReader(output);
    var page = reader.parsePage(0).getDictionary();
    assert.equal(page.exists("Annots"), false, "HTML markup is not annotated");
    var content = (function () {
      var contents = reader.queryDictionaryObject(page, "Contents");
      var streams =
        contents.getType() === muhammara.ePDFObjectArray
          ? contents
              .toPDFArray()
              .toJSArray()
              .map((reference) =>
                reader.parseNewObject(
                  reference.toPDFIndirectObjectReference().getObjectID(),
                ),
              )
          : [contents];
      return streams
        .map(function (stream) {
          var input = reader.startReadingFromStream(stream.toPDFStream());
          var chunks = [];
          while (input.notEnded()) chunks.push(Buffer.from(input.read(4096)));
          return Buffer.concat(chunks).toString("latin1");
        })
        .join("\n");
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
