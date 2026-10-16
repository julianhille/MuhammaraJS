import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { drawnContent } from "../support/pdf.mjs";
import { hasAnnots, readAnnotations } from "../support/annotations.mjs";

/**
 * An annotation color as 0..255 components.
 * @param {number[]} color - The /C entry, components from 0 to 1.
 * @returns {number[]} The components scaled to 0..255.
 */
function toBytes(color) {
  return color.map((part) => Math.round(part * 255));
}

describeEnds("Recipe annotation", function (end) {
  it("writes flag names and bit masks and rejects unknown flags", function () {
    var recipe = end.newRecipe().createPage(200, 200);
    assert.throws(
      () => recipe.annot(20, 20, "Square", { flag: "bogus" }),
      /Unknown annotation flag \(bogus\)/,
    );
    var bytes = recipe
      .annot(20, 20, "Square", { width: 10, height: 10, flag: 4 })
      .annot(20, 60, end.Recipe.AnnotSubtype.SQUARE, {
        width: 10,
        height: 10,
        flag: end.Recipe.AnnotFlag.LOCKED_CONTENTS,
      })
      .annot(20, 100, "highlight", { width: 50, height: 10 })
      .endPage()
      .endPDF();
    writeOutput(end, "annotation-flags", bytes);
    var annotations = readAnnotations(end, bytes);
    assert.deepEqual(
      annotations.map((annotation) => annotation.F),
      [4, 512, 0],
    );
    // A known subtype is written with its PDF casing and markup color.
    assert.equal(annotations[2].Subtype, "Highlight");
    assert.deepEqual(annotations[2].C, [1, 1, 0]);
  });

  it("resolves annotation colors and rejects unknown ones", function () {
    var recipe = end.newRecipe().createPage(200, 200);
    recipe.chroma("brand", "#336699");
    [
      "bogus",
      "ff0000",
      "#ff00",
      "#ff00001",
      "%1,2",
      "%101,0,0",
      0xff0000,
    ].forEach(function (color) {
      assert.throws(() => recipe.annot(20, 20, "Square", { color }), {
        name: "TypeError",
        message: `Unknown annotation color (${color})`,
      });
    });
    assert.throws(() => recipe.comment("note", 20, 20, { color: "bogus" }), {
      name: "TypeError",
      message: "Unknown annotation color (bogus)",
    });
    [[1, 2], [256, 0, 0], [-1, 0, 0], [Number.NaN]].forEach(function (color) {
      assert.throws(() => recipe.annot(20, 20, "Square", { color }), {
        name: "TypeError",
        message:
          "Annotation colors need one, three, or four numbers from 0 to 255",
      });
    });
    [
      "#FF0000",
      "%0,100,0",
      "NaVy",
      "green",
      "brand",
      [255, 255, 0],
      [128],
      [0, 255, 0, 0],
      [1, 0, 0],
    ].forEach(function (color, index) {
      recipe.annot(20, 10 + index * 20, "Square", {
        width: 10,
        height: 10,
        color,
      });
    });
    recipe.comment("note", 150, 20, { color: "DarkMagenta" });
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "annotation-colors", bytes);
    assert.deepEqual(
      readAnnotations(end, bytes).map((annotation) => toBytes(annotation.C)),
      [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 128],
        [0, 255, 0],
        [0x33, 0x66, 0x99],
        [255, 255, 0],
        [128],
        [0, 255, 0, 0],
        [1, 0, 0],
        [0x8b, 0, 0x8b],
      ],
    );
  });

  it("rejects invalid text markup before drawing the text", function () {
    /**
     * Renders "Kept", after rejected markup calls when `reject` is set.
     * @param {boolean} reject - Whether to attempt the rejected markup first.
     * @returns {string} The drawn content of the page.
     */
    var render = function (reject) {
      var recipe = end.newRecipe().createPage(200, 200);
      if (reject) {
        assert.throws(
          () =>
            recipe.text("Rejected", 20, 20, { underline: { color: "bogus" } }),
          { name: "TypeError", message: "Unknown annotation color (bogus)" },
        );
        assert.throws(
          () =>
            recipe.text("Rejected", 20, 20, { highlight: true, flag: "bogus" }),
          /Unknown annotation flag \(bogus\)/,
        );
      }
      var bytes = recipe.text("Kept", 20, 60).endPage().endPDF();
      writeOutput(
        end,
        `annotation-markup-${reject ? "rejected" : "plain"}`,
        bytes,
      );
      assert.equal(hasAnnots(end, bytes), false);
      return drawnContent(end, bytes);
    };
    var kept = render(false);
    assert.match(kept, /\bT[jJ]\b/);
    assert.equal(render(true), kept);
  });

  it("writes links, comments, and square annotations", function () {
    var bytes = end
      .newRecipe()
      .createPage(595, 842)
      .link("https://example.com", 50, 300, 160, 24)
      .text("Linked text", 50, 250, { link: "https://text.example.com" })
      .text('<a href="https://html.example.com">HTML link</a>', 180, 250, {
        html: true,
      })
      .image(end.image("images/png/pnglogo-grr.png"), 50, 275, {
        width: 40,
        height: 40,
        keepAspectRatio: false,
        align: "center center",
        link: "https://image.example.com",
      })
      .rectangle(110, 300, 100, 24, {
        fill: "#dbeafe",
        link: "https://shape.example.com",
      })
      .rectangle(250, 100, 40, 40, {
        fill: "#dbeafe",
        useGivenCoords: true,
        link: "https://pdf-coordinates.example.com",
      })
      .comment("A browser comment", 250, 300, { title: "Muhammara" })
      .annot(350, 300, "Square", { width: 60, height: 30, text: "A square" })
      .endPage()
      .endPDF();
    writeOutput(end, "annotation-links", bytes);
    var annotations = readAnnotations(end, bytes);
    var links = annotations.filter(
      (annotation) => annotation.Subtype === "Link",
    );
    /**
     * The rectangle of the link to a URL.
     * @param {string} uri - The link target.
     * @returns {number[]} The link's /Rect.
     */
    var rectOf = (uri) => links.find((link) => link.A.URI === uri).Rect;
    assert.deepEqual(rectOf("https://example.com"), [50, 518, 210, 542]);
    assert.deepEqual(rectOf("https://image.example.com"), [30, 547, 70, 587]);
    assert.deepEqual(
      rectOf("https://pdf-coordinates.example.com"),
      [250, 100, 290, 140],
    );
    assert.deepEqual(links.map((link) => link.A.URI).sort(), [
      "https://example.com",
      "https://html.example.com",
      "https://image.example.com",
      "https://pdf-coordinates.example.com",
      "https://shape.example.com",
      "https://text.example.com",
    ]);
    var comment = annotations.find(
      (annotation) => annotation.Subtype === "Text",
    );
    assert.equal(comment.Contents, "A browser comment");
    assert.equal(comment.T, "Muhammara");
    var square = annotations.find(
      (annotation) => annotation.Subtype === "Square",
    );
    assert.equal(square.Contents, "A square");
  });
});
