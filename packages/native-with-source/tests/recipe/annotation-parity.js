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

  /** Copies the generated PDF to tests/output/<name>.pdf for manual review. */
  function writeOutput(name) {
    var directory = path.join(__dirname, "../output");
    fs.mkdirSync(directory, { recursive: true });
    fs.copyFileSync(output, path.join(directory, name + ".pdf"));
  }

  ["new", "edited"].forEach(function (mode) {
    [false, true].forEach(function (html) {
      it(`clips ${html ? "HTML" : "plain"} text markup to the box on ${mode} pages`, async function () {
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
        var annotations = await finish(recipe);
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
    writeOutput("text-markup-annotations");
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
    writeOutput("html-underline-strikeout-lines");
    reader = muhammara.createReader(output);
    var page = reader.parsePage(0).getDictionary();
    assert.equal(page.exists("Annots"), false, "HTML markup is not annotated");
    var content = readPageContent(reader);
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

  it("writes the declared annotation flags", async function () {
    var recipe = new muhammara.Recipe("new", output)
      .createPage(200, 200)
      .annot(10, 10, "Square", {
        width: 5,
        height: 5,
        flag: muhammara.Recipe.AnnotFlag.LOCKED_CONTENTS,
      })
      .annot(20, 10, "Square", { width: 5, height: 5, flag: "ReadOnly" });
    await new Promise(function (resolve) {
      recipe.endPage().endPDF(resolve);
    });
    reader = muhammara.createReader(output);
    assert.deepEqual(
      readAnnotations(reader).map(
        (annotation) => annotation.dictionary.F.value,
      ),
      [512, 64],
    );
  });

  it("writes lower-case markup subtypes with their PDF casing and color", async function () {
    var recipe = new muhammara.Recipe("new", output)
      .createPage(200, 200)
      .annot(10, 10, "highlight", { width: 50, height: 10 });
    await new Promise(function (resolve) {
      recipe.endPage().endPDF(resolve);
    });
    reader = muhammara.createReader(output);
    var dictionary = readAnnotations(reader)[0].dictionary;
    assert.equal(dictionary.Subtype.value, "Highlight");
    assert.deepEqual(
      dictionary.C.toJSArray().map((value) => value.value),
      [1, 1, 0],
    );
  });

  it('centers a link at "center" coordinates', async function () {
    var recipe = new muhammara.Recipe("new", output)
      .createPage(200, 200)
      .link("https://center.test", "center", "center", 10, 10);
    await new Promise(function (resolve) {
      recipe.endPage().endPDF(resolve);
    });
    reader = muhammara.createReader(output);
    var rect = readAnnotations(reader)[0]
      .dictionary.Rect.toJSArray()
      .map((value) => value.value);
    assert.deepEqual(rect, [100, 90, 110, 100]);
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

  it("writes non-ASCII annotation text and supplied rich text", async function () {
    var source = path.join(directory, "source.pdf");
    await new Promise(function (resolve) {
      new muhammara.Recipe("new", source)
        .createPage(595, 842)
        .endPage()
        .endPDF(resolve);
    });
    var xml = '<?xml version="1.0"?><body><p>Supplied.</p></body>';
    for (var mode of ["new", "edited"]) {
      var recipe = new muhammara.Recipe(
        mode === "new" ? "new" : source,
        output,
      );
      if (mode === "new") recipe.createPage(595, 842);
      else recipe.editPage(1);
      recipe
        .comment("Größe ✓", 50, 50, { title: "Jürgen", subject: "Prüfung" })
        .comment(xml, 50, 100, { richText: true });
      await new Promise(function (resolve) {
        recipe.endPage().endPDF(resolve);
      });
      reader = muhammara.createReader(output);
      var annotations = readAnnotations(reader);
      assert.equal(annotations[0].dictionary.Contents.toText(), "Größe ✓");
      assert.equal(annotations[0].dictionary.T.toText(), "Jürgen");
      assert.equal(annotations[0].dictionary.Subj.toText(), "Prüfung");
      assert.equal(annotations[1].dictionary.RC.toText(), xml);
      reader.end();
      reader = undefined;
    }
  });

  ["new", "edited"].forEach(function (mode) {
    it(`inherits parent metadata for replies on ${mode} pages`, async function () {
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
      if (mode === "new") recipe.createPage(595, 842);
      else recipe.editPage(1);
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
      var annotations = await finish(recipe);
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

  it("converts annotation text like native and inherits empty reply flags", async function () {
    var recipe = new muhammara.Recipe("new", output).createPage(595, 842);
    recipe.comment("Parent.", 50, 50, {
      title: null,
      subject: 42,
      flag: "print",
      replies: [{ text: 7, flag: "" }],
    });
    recipe.text("Marked.", 50, 100, { highlight: { text: null } });
    var annotations = await finish(recipe);
    assert.equal(annotations[0].dictionary.T?.toText() ?? "", "");
    assert.equal(annotations[0].dictionary.Subj.toText(), "42");
    assert.equal(annotations[1].dictionary.Contents.toText(), "7");
    assert.equal(annotations[1].dictionary.F.toNumber(), 4);
    assert.equal(annotations[2].dictionary.Subtype.toString(), "Highlight");
    assert.equal(annotations[2].dictionary.Contents?.toText() ?? "", "");
  });

  ["new", "edited"].forEach(function (mode) {
    it(`preserves zero and false annotation metadata on ${mode} pages`, async function () {
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
      if (mode === "new") recipe.createPage(595, 842);
      else recipe.editPage(1);
      recipe.comment("Parent.", 50, 50, {
        title: 0,
        subject: false,
        replies: [{ text: "Reply." }],
      });
      recipe.comment("Other.", 50, 100, { title: false, subject: 0 });
      var annotations = await finish(recipe);
      [0, 1].forEach(function (index) {
        assert.equal(annotations[index].dictionary.T?.toText(), "0");
        assert.equal(annotations[index].dictionary.Subj?.toText(), "false");
      });
      assert.equal(annotations[2].dictionary.T?.toText(), "false");
      assert.equal(annotations[2].dictionary.Subj?.toText(), "0");
    });

    it(`rejects unsupported URLs before queuing links on ${mode} pages`, async function () {
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
      if (mode === "new") recipe.createPage(595, 842);
      else recipe.editPage(1);
      recipe.text("Keep this content.", 50, 30);
      recipe.link("https://valid.test", 50, 50, 80, 12);
      [42, "https://example.test/✓"].forEach(function (url) {
        assert.throws(function () {
          recipe.link(url, 50, 80, 80, 12);
        });
      });
      recipe.link(encodeURI("https://example.test/✓"), 50, 110, 80, 12);
      var annotations = await finish(recipe);
      assert.deepEqual(subtypes(annotations), ["Link", "Link"]);
      assert.match(
        mode === "new" ? readPageContent(reader) : readPageForms(reader),
        /Tj/,
      );
    });
  });

  ["new", "edited"].forEach(function (mode) {
    it(`keeps negative link sizes over the same area on ${mode} pages`, async function () {
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
      if (mode === "new") recipe.createPage(595, 842);
      else recipe.editPage(1);
      recipe.link("https://negative.test", 100, 150, -40, -10);
      recipe.rectangle(100, 200, -50, 20, { link: "https://shape.test" });
      var annotations = await finish(recipe);
      assert.deepEqual(
        annotations.map(function (annotation) {
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
});
