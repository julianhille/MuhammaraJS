import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import {
  drawnContent,
  pageContent,
  pageCount,
  textRuns,
  withReader,
} from "../support/pdf.mjs";
import {
  hasAnnots,
  openPage,
  pdfDateToTime,
  readAnnotations,
  sourcePdf,
  subtypes,
  textShowCount,
} from "../support/annotations.mjs";

/**
 * A test title as an output file name.
 * @param {string} title - The test title.
 * @returns {string} The name, prefixed with the spec name.
 */
function outputName(title) {
  return (
    "annotation-parity-" +
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

describeEnds("Recipe annotation parity", function (end) {
  /**
   * Finish the page and document, write the bytes for review, and read the
   * annotations of a page.
   * @param {object} test - The running mocha test.
   * @param {object} recipe - Recipe with an open page.
   * @param {number} [pageIndex=0] - The zero-based page to read.
   * @returns {{bytes: Uint8Array, annotations: object[]}} The PDF and the
   *   annotations of the page.
   */
  function finish(test, recipe, pageIndex = 0) {
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, outputName(test.title), bytes);
    return { bytes, annotations: readAnnotations(end, bytes, pageIndex) };
  }

  ["new", "edited"].forEach(function (mode) {
    [false, true].forEach(function (html) {
      it(`clips ${html ? "HTML" : "plain"} text markup to the box on ${mode} pages`, function () {
        var recipe = openPage(end, mode, 300, 300);
        ["left", "center", "right"].forEach(function (alignment, index) {
          recipe.text(
            "This sentence is much wider than the clipped text box.",
            50,
            40 + index * 70,
            {
              font: "arial",
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
        var { annotations } = finish(this.test, recipe);
        assert.equal(annotations.length, 6);
        annotations.forEach(function (annotation, index) {
          var top = 300 - (40 + Math.floor(index / 2) * 70);
          var bottom = top - 24;
          var rect = annotation.Rect;
          assert.ok(
            rect[0] >= 49.99 && rect[2] <= 150.01 && rect[2] > rect[0],
            `horizontal bounds: ${rect}`,
          );
          assert.ok(
            rect[1] >= bottom - 0.01 && rect[3] <= top + 0.01,
            `vertical bounds: ${rect}`,
          );
          annotation.QuadPoints.forEach(function (number, coordinate) {
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
        var recipe = openPage(end, mode, 300, 300);
        ["left", "center", "right"].forEach(function (alignment, index) {
          recipe.text(
            "OverlongClickableWordWithoutSpaces".repeat(3),
            50,
            40 + index * 70,
            {
              font: "arial",
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
        var { annotations } = finish(this.test, recipe);
        assert.deepEqual(subtypes(annotations), ["Link", "Link", "Link"]);
        annotations.forEach(function (annotation, index) {
          var top = 300 - (40 + index * 70);
          var rect = annotation.Rect;
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

  it("keeps text links on their page across overflow callbacks", function () {
    var recipe = end.newRecipe().createPage(200, 200);
    var overflows = 0;
    recipe
      .layout("links", 20, 20, 100, 24, { columns: 1 })
      .text("First\nSecond\nThird", {
        font: "arial",
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
    var { bytes } = finish(this.test, recipe);
    assert.equal(overflows, 2);
    assert.equal(pageCount(end, bytes), 3);
    for (var index = 0; index < 3; index++) {
      assert.deepEqual(subtypes(readAnnotations(end, bytes, index)), ["Link"]);
    }
  });

  it("writes text links before onClip ends the page", function () {
    var recipe = end.newRecipe().createPage(200, 200);
    var clipped = false;
    recipe.text("First\nSecond", 20, 20, {
      font: "arial",
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
    var bytes = recipe.endPDF();
    writeOutput(end, outputName(this.test.title), bytes);
    assert.equal(clipped, true);
    assert.deepEqual(subtypes(readAnnotations(end, bytes)), ["Link"]);
  });

  it("retains edited content when linked text overflows on the same page", function () {
    var recipe = openPage(end, "edited", 300, 300);
    var overflows = 0;
    recipe
      .layout("links", 20, 20, 100, 24, { columns: 1 })
      .text("First\nSecond\nThird", {
        font: "arial",
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
    var { bytes, annotations } = finish(this.test, recipe);
    assert.equal(overflows, 2);
    assert.equal(pageCount(end, bytes), 1);
    assert.deepEqual(subtypes(annotations), ["Link", "Link", "Link"]);
    assert.ok(textShowCount(end, bytes) >= 1, "the edited text is drawn");
  });

  it("writes fractional and zero opacity while keeping the opaque default", function () {
    var recipe = end.newRecipe().createPage(595, 842);
    var opacities = [0.45, 0, 1, undefined];
    opacities.forEach(function (opacity, index) {
      recipe.annot(100, 200 + index * 30, "Highlight", {
        width: 200,
        height: 14,
        color: "#ffff00",
        opacity: opacity,
      });
    });
    var { annotations } = finish(this.test, recipe);
    assert.equal(annotations.length, opacities.length);
    annotations.forEach(function (annotation, index) {
      assert.equal(annotation.Subtype, "Highlight");
      assert.equal(annotation.CA ?? 1, opacities[index] ?? 1);
      assert.deepEqual(annotation.C, [1, 1, 0]);
    });
  });

  it("links every comment and annot reply to its own parent dictionary", function () {
    var recipe = end.newRecipe().createPage(595, 842);
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
    var { bytes, annotations } = finish(this.test, recipe);
    // the annotation pass appends its objects to the file on their own line
    assert.doesNotMatch(Buffer.from(bytes).toString("latin1"), /%%EOF\d/);
    assert.equal(annotations.length, 8);
    [0, 3].forEach(function (index) {
      var parent = annotations[index];
      assert.equal(parent.Contents, "Please review.");
      assert.equal(parent.T, "Review");
      assert.equal(parent.IRT, undefined);
      options.replies.forEach(function (reply, replyIndex) {
        var written = annotations[index + replyIndex + 1];
        assert.equal(written.Subtype, "Text");
        assert.equal(written.Contents, reply.text);
        assert.equal(written.T, reply.title);
        assert.equal(written.CA ?? 1, reply.opacity ?? 1);
        assert.equal(written.IRT, parent.id);
        assert.equal(written.RT, "R");
      });
    });
    assert.equal(annotations[0].Name, "Comment");
    assert.equal(annotations[6].Contents, "No replies.");
    assert.equal(annotations[7].Contents, "Empty replies.");
    assert.doesNotThrow(() =>
      end
        .newRecipe()
        .createPage(100, 100)
        .comment("Null reply.", 10, 10, { replies: [null] }),
    );
  });

  it("writes squiggly text markup options", function () {
    var recipe = end.newRecipe().createPage(595, 842);
    recipe.text("Review this text.", 50, 100, {
      squiggly: {
        text: "Needs review.",
        color: [255, 0, 0],
        opacity: 0.4,
        replies: [{ text: "Confirmed.", title: "Reviewer", opacity: 0.2 }],
      },
    });
    var { annotations } = finish(this.test, recipe);
    assert.equal(annotations.length, 2);
    assert.equal(annotations[0].Subtype, "Squiggly");
    assert.equal(annotations[0].Contents, "Needs review.");
    assert.equal(annotations[0].CA, 0.4);
    assert.deepEqual(annotations[0].C, [1, 0, 0]);
    assert.equal(annotations[1].Contents, "Confirmed.");
    assert.equal(annotations[1].T, "Reviewer");
    assert.equal(annotations[1].CA, 0.2);
    assert.equal(annotations[1].IRT, annotations[0].id);
  });

  it("adds text markup only for requested options", function () {
    var recipe = end.newRecipe().createPage(595, 842);
    recipe.text("Marked text.", 50, 100, {
      font: "arial",
      highlight: true,
      underline: { text: "Underlined." },
      strikeOut: true,
      squiggly: false,
      title: "Reviewer",
    });
    recipe.text("Plain text.", 50, 200, {
      font: "arial",
      underline: false,
      highlight: false,
    });
    recipe.text("<u>Decorated</u> <s>only</s>.", 50, 300, {
      font: "arial",
      html: true,
      size: 14,
      textBox: { width: 300 },
    });
    var { annotations } = finish(this.test, recipe);
    assert.deepEqual(subtypes(annotations), [
      "Highlight",
      "Underline",
      "StrikeOut",
    ]);
    annotations.forEach(function (annotation) {
      assert.equal(annotation.T, "Reviewer");
      assert.equal(annotation.QuadPoints.length, 8);
    });
    assert.equal(annotations[1].Contents, "Underlined.");
  });

  it("places text markup annotations from text options", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    recipe
      .text("Hello", 50, 100, { font: "arial", underline: true })
      .text("Hello", 50, 150, {
        font: "arial",
        strikeOut: { color: "#0000ff", text: "cut" },
        title: "Editor",
      })
      .text("Hello", 50, 200, { font: "arial", highlight: true });
    var { annotations } = finish(this.test, recipe);
    /**
     * Round the numbers of a PDF array to three decimals.
     * @param {number[]} values - The numbers.
     * @returns {number[]} The rounded numbers.
     */
    var rounded = (values) => values.map((value) => Number(value.toFixed(3)));
    assert.deepEqual(
      annotations.map((annotation) => ({
        subtype: annotation.Subtype,
        color: rounded(annotation.C),
        rect: rounded(annotation.Rect),
        quadPoints: rounded(annotation.QuadPoints),
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
    assert.equal(annotations[1].Contents, "cut");
    assert.equal(annotations[1].T, "Editor");
  });

  it("draws HTML underline and del as text-colored lines, not annotations", function () {
    var bytes = end
      .newRecipe()
      .createPage(400, 400)
      .text("<u>Hello</u>", 50, 100, { font: "arial", html: true })
      .text("<del>Hello</del>", 50, 150, {
        font: "arial",
        html: true,
        color: "#ff0000",
      })
      .endPage()
      .endPDF();
    writeOutput(end, outputName(this.test.title), bytes);
    assert.equal(hasAnnots(end, bytes), false, "HTML markup is not annotated");
    var baselines = textRuns(end, bytes).map((run) => run.y);
    var content = drawnContent(end, bytes);
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

  it("rejects links between pages instead of queuing them on the next page", function () {
    var recipe = end.newRecipe().createPage(595, 842).endPage();
    assert.throws(function () {
      recipe.link("https://invalid.test", 50, 100, 80, 12);
    });
    recipe.createPage(595, 842).link("https://valid.test", 50, 100, 80, 12);
    var { bytes } = finish(this.test, recipe);
    assert.equal(hasAnnots(end, bytes, 0), false);
    assert.equal(readAnnotations(end, bytes, 1).length, 1);
  });

  it("writes the declared annotation flags", function () {
    var recipe = end
      .newRecipe()
      .createPage(200, 200)
      .annot(10, 10, "Square", {
        width: 5,
        height: 5,
        flag: end.Recipe.AnnotFlag.LOCKED_CONTENTS,
      })
      .annot(20, 10, "Square", { width: 5, height: 5, flag: "ReadOnly" });
    var { annotations } = finish(this.test, recipe);
    assert.deepEqual(
      annotations.map((annotation) => annotation.F),
      [512, 64],
    );
  });

  it("writes lower-case markup subtypes with their PDF casing and color", function () {
    var recipe = end
      .newRecipe()
      .createPage(200, 200)
      .annot(10, 10, "highlight", { width: 50, height: 10 });
    var [annotation] = finish(this.test, recipe).annotations;
    assert.equal(annotation.Subtype, "Highlight");
    assert.deepEqual(annotation.C, [1, 1, 0]);
  });

  it('centers a link at "center" coordinates', function () {
    var recipe = end
      .newRecipe()
      .createPage(200, 200)
      .link("https://center.test", "center", "center", 10, 10);
    var [annotation] = finish(this.test, recipe).annotations;
    assert.deepEqual(annotation.Rect, [100, 90, 110, 100]);
  });

  [false, true].forEach(function (html) {
    [1, 0.5].forEach(function (opacity) {
      it(`covers each justified ${html ? "HTML" : "plain"} line with markup at opacity ${opacity}`, function () {
        var recipe = end.newRecipe().createPage(300, 300);
        var highlight = { text: "Check." };
        recipe.text("alpha beta gamma delta epsilon", 50, 50, {
          font: "arial",
          html,
          opacity,
          size: 14,
          highlight,
          textBox: { width: 120, padding: 10, textAlign: "justify" },
        });
        var { annotations } = finish(this.test, recipe);
        assert.ok(annotations.length > 1);
        annotations.forEach(function (annotation, index) {
          var rect = annotation.Rect;
          assert.ok(Math.abs(rect[0] - 60) < 0.01);
          if (index < annotations.length - 1)
            assert.ok(Math.abs(rect[2] - rect[0] - 100) < 0.01);
        });
        assert.deepEqual(highlight, { text: "Check." });
      });
    });
  });

  it("keeps the page content readable when annotations share the page", function () {
    var recipe = end.newRecipe().createPage(595, 842);
    recipe.text("Commented text.", 50, 100, {
      font: "arial",
      highlight: true,
    });
    recipe.comment("Please review.", 300, 100);
    recipe.link("https://example.test", 50, 150, 80, 12);
    recipe.text("Linked text.", 50, 180, {
      font: "arial",
      link: "https://text.test",
    });
    var source = recipe.endPage().endPDF();
    writeOutput(end, outputName(this.test.title) + "-source", source);
    var texts = (bytes) => textRuns(end, bytes).map((run) => run.text);
    assert.deepEqual(texts(source), ["Commented text.", "Linked text."]);
    // Every saved graphics state is restored, so the content stays valid.
    var content = pageContent(end, source);
    assert.equal(
      (content.match(/\bq\b/g) || []).length,
      (content.match(/\bQ\b/g) || []).length,
    );
    assert.deepEqual(subtypes(readAnnotations(end, source)), [
      "Link",
      "Link",
      "Highlight",
      "Text",
    ]);

    var bytes = end
      .openRecipe(source)
      .editPage(1)
      .text("Edited text.", 50, 200, {
        font: "arial",
        underline: true,
        strikeOut: true,
      })
      .link("https://edited.test", 50, 220, 80, 12)
      .endPage()
      .endPDF();
    writeOutput(end, outputName(this.test.title) + "-edited", bytes);
    // The source text stays readable and the edited text is drawn too.
    assert.deepEqual(texts(bytes).slice(0, 2), [
      "Commented text.",
      "Linked text.",
    ]);
    assert.equal(textShowCount(end, bytes), textShowCount(end, source) + 1);
    assert.deepEqual(subtypes(readAnnotations(end, bytes)), [
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
      var recipe = openPage(
        end,
        mode === "new" || mode === "added" ? mode : "edited",
        595,
        842,
      );
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
      var pageIndex = mode === "added" ? 1 : 0;
      var { bytes, annotations } = finish(this.test, recipe, pageIndex);
      var parent = annotations.find((annotation) => annotation.RC);
      assert.equal(annotations.length, 5);
      assert.equal(parent.Subj, "Review subject");
      assert.equal(pdfDateToTime(parent.M), Date.parse("2026-01-02T03:04:05Z"));
      assert.match(parent.RC, /<p>Needs review\.<\/p>/);
      assert.equal(parent.T, "Reviewer");
      assert.equal(parent.CA, 0.4);
      var reply = annotations.find(
        (annotation) => annotation.Contents === "Confirmed.",
      );
      assert.equal(reply.IRT, parent.id);
      assert.equal(reply.RT, "R");
      assert.equal(
        textShowCount(end, bytes, pageIndex),
        mode === "resumed" ? 2 : 1,
      );
    });
  });

  it("rejects invalid annotation values alike on new and edited pages", function () {
    [
      { opacity: 2 },
      { borderDash: ["x"] },
      { quadPoints: [1, 2, 3] },
      { borderWidth: Number.NaN },
      { width: Number.NaN },
      { height: Number.NaN },
      { border: { width: Infinity } },
      { replies: [{ text: "reply", opacity: -1 }] },
    ].forEach(function (options, optionsIndex) {
      ["new", "edited"].forEach(function (mode) {
        var recipe = openPage(end, mode, 595, 842);
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
        var bytes = recipe.endPage().endPDF();
        writeOutput(
          end,
          `annotation-parity-invalid-values-${optionsIndex}-${mode}`,
          bytes,
        );
        assert.deepEqual(subtypes(readAnnotations(end, bytes)), ["Text"]);
        assert.equal(textShowCount(end, bytes), 1);
      });
    });
  });

  it("rejects invalid text markup before drawing, moving or queuing", function () {
    ["new", "edited"].forEach(function (mode) {
      var recipe = openPage(end, mode, 595, 842);
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
      var bytes = recipe.endPage().endPDF();
      writeOutput(end, `annotation-parity-invalid-markup-${mode}`, bytes);
      // The page ends with its content and only the valid annotation.
      assert.deepEqual(subtypes(readAnnotations(end, bytes)), ["Text"]);
      assert.equal(textShowCount(end, bytes), 1);
    });
  });

  ["new", "edited"].forEach(function (mode) {
    it(`inherits parent metadata for replies on ${mode} pages`, function () {
      var recipe = openPage(end, mode, 595, 842);
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
      var [parent, inherited, overridden] = finish(
        this.test,
        recipe,
      ).annotations;
      assert.equal(inherited.T, "Reviewer");
      assert.equal(inherited.Subj, "Review subject");
      assert.equal(inherited.M, parent.M);
      assert.equal(inherited.F, 4);
      assert.equal(inherited.Name, "Comment");
      assert.equal(inherited.Open, true);
      assert.equal(inherited.Contents, "Inherited.");
      assert.equal(inherited.RC, undefined);
      assert.equal(inherited.CA ?? 1, 1);
      assert.equal(overridden.T, "Editor");
      assert.equal(overridden.Subj, "Other");
      assert.equal(overridden.F, 2);
    });
  });

  it("writes non-ASCII annotation text and supplied rich text", function () {
    var xml = '<?xml version="1.0"?><body><p>Supplied.</p></body>';
    ["new", "edited"].forEach(function (mode) {
      var bytes = openPage(end, mode, 595, 842)
        .comment("Größe ✓", 50, 50, { title: "Jürgen", subject: "Prüfung" })
        .comment(xml, 50, 100, { richText: true })
        .endPage()
        .endPDF();
      writeOutput(end, `annotation-parity-non-ascii-${mode}`, bytes);
      var annotations = readAnnotations(end, bytes);
      assert.equal(annotations[0].Contents, "Größe ✓");
      assert.equal(annotations[0].T, "Jürgen");
      assert.equal(annotations[0].Subj, "Prüfung");
      assert.equal(annotations[1].RC, xml);
    });
  });

  it("converts annotation text to strings and inherits empty reply flags", function () {
    var recipe = end.newRecipe().createPage(595, 842);
    recipe.comment("Parent.", 50, 50, {
      title: null,
      subject: 42,
      flag: "print",
      replies: [{ text: 7, flag: "" }],
    });
    recipe.text("Marked.", 50, 100, { highlight: { text: null } });
    // A parent's `flag` wins over its `flags`, for its replies too.
    recipe.comment("Zero flag.", 50, 150, {
      flag: 0,
      flags: 4,
      replies: [{ text: "Reply." }],
    });
    var { annotations } = finish(this.test, recipe);
    assert.equal(annotations[0].T ?? "", "");
    assert.equal(annotations[0].Subj, "42");
    assert.equal(annotations[1].Contents, "7");
    assert.equal(annotations[1].F, 4);
    assert.equal(annotations[2].Subtype, "Highlight");
    assert.equal(annotations[2].Contents ?? "", "");
    assert.equal(annotations[3].F, 0);
    assert.equal(annotations[4].F, 0);
  });

  ["new", "edited"].forEach(function (mode) {
    it(`preserves zero and false annotation metadata on ${mode} pages`, function () {
      var recipe = openPage(end, mode, 595, 842);
      recipe.comment("Parent.", 50, 50, {
        title: 0,
        subject: false,
        replies: [{ text: "Reply." }],
      });
      recipe.comment("Other.", 50, 100, { title: false, subject: 0 });
      var { annotations } = finish(this.test, recipe);
      [0, 1].forEach(function (index) {
        assert.equal(annotations[index].T, "0");
        assert.equal(annotations[index].Subj, "false");
      });
      assert.equal(annotations[2].T, "false");
      assert.equal(annotations[2].Subj, "0");
    });

    it(`rejects unsupported URLs before queuing links on ${mode} pages`, function () {
      var recipe = openPage(end, mode, 595, 842);
      recipe.text("Keep this content.", 50, 30);
      recipe.link("https://valid.test", 50, 50, 80, 12);
      [42, "https://example.test/✓"].forEach(function (url) {
        assert.throws(function () {
          recipe.link(url, 50, 80, 80, 12);
        });
      });
      recipe.link(encodeURI("https://example.test/✓"), 50, 110, 80, 12);
      var { bytes, annotations } = finish(this.test, recipe);
      assert.deepEqual(subtypes(annotations), ["Link", "Link"]);
      assert.deepEqual(
        annotations.map((annotation) => annotation.A.URI),
        ["https://valid.test", encodeURI("https://example.test/✓")],
      );
      assert.equal(textShowCount(end, bytes), 1);
    });
  });

  ["new", "added", "edited"].forEach(function (mode) {
    it(`rejects invalid link rectangles before queuing on ${mode} pages`, function () {
      var recipe = openPage(end, mode, 595, 842);
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
      var pageIndex = mode === "added" ? 1 : 0;
      var { bytes, annotations } = finish(this.test, recipe, pageIndex);
      assert.deepEqual(subtypes(annotations), ["Link", "Link", "Link"]);
      annotations.forEach(function (annotation) {
        annotation.Rect.forEach(function (value) {
          assert.ok(Number.isFinite(value));
        });
      });
      assert.equal(textShowCount(end, bytes, pageIndex), 2);
    });
  });

  ["new", "edited"].forEach(function (mode) {
    it(`keeps negative link sizes over the same area on ${mode} pages`, function () {
      var recipe = openPage(end, mode, 595, 842);
      recipe.link("https://negative.test", 100, 150, -40, -10);
      recipe.rectangle(100, 200, -50, 20, { link: "https://shape.test" });
      var { annotations } = finish(this.test, recipe);
      assert.deepEqual(
        annotations.map(function (annotation) {
          var [left, bottom, right, top] = annotation.Rect;
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
      var recipe = openPage(end, mode, 595, 842);
      recipe.text("Marked.", 50, 100, { highlight: true });
      recipe.annot(50, 150, "Square", { width: 20, height: 20 });
      recipe.comment("", 50, 200, { richText: true });
      var { annotations } = finish(this.test, recipe);
      assert.deepEqual(annotations[0].Border, [0, 0, 0]);
      assert.equal(annotations[1].Border, undefined);
      assert.equal(annotations[2].RC, undefined);
      assert.equal(annotations[2].Contents, undefined);
    });
  });

  ["new", "edited"].forEach(function (mode) {
    it(`anchors annot() at the rectangle's top-left corner on ${mode} pages`, function () {
      var recipe = openPage(end, mode, 200, 300)
        .annot(10, 100, end.Recipe.AnnotSubtype.SQUARE, {
          width: 40,
          height: 30,
        })
        .annot(10, 100, end.Recipe.AnnotSubtype.HIGHLIGHT, {
          width: 40,
          height: 30,
        });
      var { annotations } = finish(this.test, recipe);
      // Recipe y 100..130 on a 300-point page is PDF y 170..200.
      annotations.forEach(function (annotation) {
        assert.deepEqual(annotation.Rect, [10, 170, 50, 200]);
      });
      assert.deepEqual(
        annotations[1].QuadPoints,
        [10, 200, 50, 200, 10, 170, 50, 170],
      );
    });
  });

  ["new", "edited"].forEach(function (mode) {
    it(`anchors comment() at the rectangle's top-left corner on ${mode} pages`, function () {
      var recipe = openPage(end, mode, 200, 300).comment("note", 10, 100, {
        width: 40,
        height: 30,
      });
      var { annotations } = finish(this.test, recipe);
      // Recipe y 100..130 on a 300-point page is PDF y 170..200.
      assert.deepEqual(annotations[0].Rect, [10, 170, 50, 200]);
    });
  });

  ["new", "edited"].forEach(function (mode) {
    it(`writes border, quad point, alias and reply options on ${mode} pages`, function () {
      var recipe = openPage(end, mode, 200, 300)
        .annot(10, 20, "Square", {
          width: 40,
          height: 30,
          border: { width: 2, dash: [3, 1] },
        })
        .annot(10, 60, "Square", {
          width: 40,
          height: 30,
          border: { width: 5 },
          borderWidth: 1,
          borderDash: [2],
        })
        .annot(10, 100, "Highlight", {
          width: 40,
          height: 10,
          quadPoints: [10, 90, 50, 90, 10, 80, 50, 80],
        })
        .annot(10, 120, "Square", { width: 40, height: 10, border: 0 })
        .annot(10, 140, "Square", { width: 40, height: 10, border: -1 })
        .comment("", 10, 160, { contents: "Alias contents", flags: 4 })
        .annot(10, 180, "Text", { text: "Named", name: "Key" })
        .comment("Parent", 10, 200, {
          replies: [{ contents: "Reply", open: true, icon: "Help", flags: 4 }],
        });
      var { annotations } = finish(this.test, recipe);
      assert.deepEqual(
        annotations.map((annotation) => ({
          border: annotation.Border ?? null,
          quad: annotation.QuadPoints ?? null,
          contents: annotation.Contents ?? null,
          flags: annotation.F,
          name: annotation.Name ?? null,
          open: annotation.Open,
        })),
        [
          {
            border: [0, 0, 2, [3, 1]],
            quad: null,
            contents: null,
            flags: 0,
            name: null,
            open: false,
          },
          {
            border: [0, 0, 1, [2]],
            quad: null,
            contents: null,
            flags: 0,
            name: null,
            open: false,
          },
          {
            border: [0, 0, 0],
            quad: [10, 90, 50, 90, 10, 80, 50, 80],
            contents: null,
            flags: 0,
            name: null,
            open: false,
          },
          {
            border: [0, 0, 0],
            quad: null,
            contents: null,
            flags: 0,
            name: null,
            open: false,
          },
          {
            border: null,
            quad: null,
            contents: null,
            flags: 0,
            name: null,
            open: false,
          },
          {
            border: null,
            quad: null,
            contents: "Alias contents",
            flags: 4,
            name: "Comment",
            open: false,
          },
          {
            border: null,
            quad: null,
            contents: "Named",
            flags: 0,
            name: "Key",
            open: false,
          },
          {
            border: null,
            quad: null,
            contents: "Parent",
            flags: 0,
            name: "Comment",
            open: false,
          },
          {
            border: null,
            quad: null,
            contents: "Reply",
            flags: 4,
            name: "Help",
            open: true,
          },
        ],
      );
    });
  });

  ["new", "edited"].forEach(function (mode) {
    it(`rejects an invalid comment() or annot() size on ${mode} pages`, function () {
      var recipe = openPage(end, mode, 200, 300);
      [
        { width: "40", height: 30 },
        { width: 40, height: "30" },
        { width: -40, height: 30 },
        { width: 40, height: -30 },
        { width: Number.NaN },
        { height: Infinity },
      ].forEach(function (size) {
        assert.throws(() => recipe.comment("note", 10, 100, size), {
          name: "TypeError",
          message: "Invalid annotation options",
        });
        assert.throws(() => recipe.annot(10, 100, "Square", size), {
          name: "TypeError",
          message: "Invalid annotation options",
        });
      });
      // Rejected annotations are never queued; a missing size is zero.
      var { annotations } = finish(
        this.test,
        recipe.comment("note", 10, 100, { width: null, height: undefined }),
      );
      assert.deepEqual(
        annotations.map((annotation) => annotation.Rect),
        [[10, 200, 10, 200]],
      );
    });
  });

  ["new", "edited"].forEach(function (mode) {
    it(`writes annotation dates, text, or no /M on ${mode} pages`, function () {
      var recipe = openPage(end, mode, 200, 300);
      var time = Date.UTC(2026, 0, 2, 3, 4, 5);
      [
        undefined,
        null,
        "",
        "yesterday",
        "2026-01-02T03:04:05Z",
        new Date(time),
        0,
      ].forEach(function (date, index) {
        recipe.annot(10, 10 + index * 10, "Square", {
          width: 5,
          height: 5,
          date: date,
          replies: [{ text: "Reply." }],
        });
      });
      var dates = finish(this.test, recipe).annotations.map(
        (annotation) => annotation.M,
      );
      // A missing date writes no /M, text is kept, and dates, 0 included,
      // are the same instant on both ends. Replies inherit the date.
      assert.deepEqual(dates.slice(0, 6), Array(6).fill(undefined));
      assert.deepEqual(dates.slice(6, 8), ["yesterday", "yesterday"]);
      dates.slice(8, 12).forEach(function (text) {
        assert.equal(pdfDateToTime(text), time);
      });
      dates.slice(12).forEach(function (text) {
        assert.equal(pdfDateToTime(text), 0);
      });
    });
  });

  ["new", "edited"].forEach(function (mode) {
    it(`rejects invalid annotation positions on ${mode} pages`, function () {
      var recipe = openPage(end, mode, 200, 300);
      [
        [Number.NaN, 50],
        [50, Number.POSITIVE_INFINITY],
        ["50", 50],
        [50, "center "],
        [undefined, 50],
        [Number.MAX_VALUE, 50, { width: Number.MAX_VALUE }],
      ].forEach(function ([x, y, size]) {
        assert.throws(() => recipe.comment("note", x, y, size), {
          name: "TypeError",
          message: "Invalid annotation options",
        });
        assert.throws(() => recipe.annot(x, y, "Square", size), {
          name: "TypeError",
          message: "Invalid annotation options",
        });
      });
      // Rejected annotations are never queued; the center stays valid.
      var { annotations } = finish(
        this.test,
        recipe.annot("center", "center", "Square", { width: 10, height: 10 }),
      );
      assert.deepEqual(
        annotations.map((annotation) => annotation.Rect),
        [[100, 140, 110, 150]],
      );
    });
  });

  /**
   * A 200x300 page with its media box moved to (10, 20) and rotated 90
   * degrees.
   * @returns {Uint8Array} The PDF.
   */
  function rotatedSource() {
    return sourcePdf(end, 200, 300, (recipe) =>
      recipe
        .setPageBox(end.muhammara.ePDFPageBoxMediaBox, 10, 20, 210, 320)
        .rotate(90),
    );
  }

  it("anchors annot() at the top-left corner on a rotated page", function () {
    var { annotations } = finish(
      this.test,
      end
        .openRecipe(rotatedSource())
        .editPage(1)
        .annot(110, 120, end.Recipe.AnnotSubtype.SQUARE, {
          width: 30,
          height: 40,
        }),
    );
    // The displayed top-left corner is the media box origin (10, 20), with
    // displayed x along +y and displayed y along +x: the 40-point height runs
    // down the visual page, +x in PDF space.
    assert.deepEqual(annotations[0].Rect, [130, 130, 170, 160]);
  });

  it("anchors comment() with and without a size on a rotated page", function () {
    var { annotations } = finish(
      this.test,
      end
        .openRecipe(rotatedSource())
        .editPage(1)
        .comment("sized", 110, 120, { width: 30, height: 40 })
        .comment("icon", 110, 120),
    );
    // A missing size is zero; it used to write nan into the rectangle.
    assert.deepEqual(
      annotations.map((annotation) => annotation.Rect),
      [
        [130, 130, 170, 160],
        [130, 130, 130, 130],
      ],
    );
  });

  it("underlines existing text like the Annotate Existing Text guide", function () {
    var source = sourcePdf(end, 595, 842, (recipe) =>
      recipe.text("Draft", 72, 120, { font: "arial", size: 12 }),
    );
    var match = withReader(end, source, (reader) => {
      var [run] = reader.extractPageText(0);
      return { x: run.textMatrix[4], y: run.textMatrix[5], size: run.fontSize };
    });
    var pdf = end.openRecipe(source);
    var page = pdf.pageInfo(1);
    var { annotations } = finish(
      this.test,
      pdf
        .editPage(1)
        .annot(
          match.x,
          page.height - match.y - match.size,
          end.Recipe.AnnotSubtype.UNDERLINE,
          { width: 28, height: match.size },
        ),
    );
    var rect = annotations[0].Rect;
    assert.equal(rect[0], match.x);
    assert.ok(Math.abs(rect[1] - match.y) < 0.001);
    assert.ok(Math.abs(rect[3] - (match.y + match.size)) < 0.001);
    // The underline is drawn along the quadrilateral's bottom: the baseline.
    assert.equal(annotations[0].QuadPoints[5], Math.round(match.y));
  });
});
