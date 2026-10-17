import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { readAnnotations, subtypes } from "../support/annotations.mjs";

describeEnds("Annotation: Comment", function (end) {
  it("adds a comment with its title and subject", function () {
    var bytes = end
      .newRecipe()
      .createPage("letter")
      .text("Click\nbelow", 298, 60)
      .text(
        "Except for the background rectangle exposing it, the annotation above would normally be invisible because no color option was given to it.",
        175,
        150,
        { textBox: { width: 280, textAlign: "center" } },
      )
      .rectangle(290, 90, 50, 50, { fill: "red", opacity: 0.2 })
      .comment("Feel free to open issues to help us!", "center", 100, {
        title: "First Comment",
        subject: "Not Really Visible",
      })
      .endPage()
      .endPDF();
    writeOutput(end, "annotation-comment", bytes);
    var annotations = readAnnotations(end, bytes);
    assert.deepEqual(subtypes(annotations), ["Text"]);
    var [comment] = annotations;
    assert.equal(comment.Contents, "Feel free to open issues to help us!");
    assert.equal(comment.T, "First Comment");
    assert.equal(comment.Subj, "Not Really Visible");
    assert.equal(comment.Name, "Comment");
    // "center" on a 612x792 letter page; y 100 from the top is PDF y 692.
    assert.deepEqual(comment.Rect, [306, 692, 306, 692]);
    // No color option writes no color.
    assert.equal(comment.C, undefined);
  });

  it("adds an open rich text comment to an edited page", function () {
    var textContent = [
      '<p style="text-align: center">Align Center</p>',
      '<span style="font-family: Helvetica">Plain Text</span>',
      "<b>Bold</b>",
      "<i>Italic</i>",
      '<span style="color: #0000ff">Blue</span>',
      '<span style="font-style: italic">Italic by font-style</span>',
      '<span style="font-size: 18pt">18pt</span>',
      '<span style="font-size: 30%">30%</span>',
      '<span style="font-weight: 800">Weight 800</span>',
      // '<span style="font-stretch: condensed">Condensed</span>',
      // '<span style="font-stretch: expanded">Expanded</span>',
      // '<span style="text-decoration: line-through">Line-Through</span>',
      '<span style="text-decoration: underline">Underline</span>',
    ];
    var bytes = end
      .openRecipe("recipe/test.pdf")
      .editPage(1)
      .comment(textContent.join("<br/>"), "center", 100, {
        richText: true,
        open: true,
        align: "center center",
      })
      .endPage()
      .endPDF();
    writeOutput(end, "annotation-comment-rich-text", bytes);
    var annotations = readAnnotations(end, bytes);
    assert.deepEqual(subtypes(annotations), ["Text"]);
    var [comment] = annotations;
    assert.equal(comment.Open, true);
    assert.match(
      comment.RC,
      /^<\?xml version="1\.0"\?><body xmlns="http:\/\/www\.w3\.org\/1999\/xhtml">/,
    );
    assert.match(comment.RC, /<\/body>$/);
    // Every piece of the rich text is kept, in order.
    var at = 0;
    textContent.forEach(function (piece) {
      var found = comment.RC.indexOf(piece, at);
      assert.ok(found >= at, `rich text keeps ${piece}`);
      at = found + piece.length;
    });
  });

  it("adds FreeText annotations at fixed and centered coordinates", function () {
    var bytes = end
      .newRecipe()
      .createPage("letter")
      .annot(300, 300, "FreeText", { text: "Yo yo yo" })
      .annot("center", "center", "FreeText", {
        text: "Do you have Free Style yo?",
        width: 200,
        height: 50,
      })
      .endPage()
      .endPDF();
    writeOutput(end, "annotation-comment-freetext", bytes);
    var annotations = readAnnotations(end, bytes);
    assert.deepEqual(subtypes(annotations), ["FreeText", "FreeText"]);
    assert.equal(annotations[0].Contents, "Yo yo yo");
    assert.equal(annotations[1].Contents, "Do you have Free Style yo?");
    var [left, bottom, right, top] = annotations[1].Rect;
    assert.equal(right - left, 200);
    assert.equal(top - bottom, 50);
  });

  // Ticket #20, need to link annotation to text
  it("adds a highlight annotation over text", function () {
    var bytes = end
      .newRecipe()
      .createPage("letter")
      .text(
        "Trace-based Just-in-Time Type Specialization for Dynamic Languages",
        100,
        "center",
        { font: "arial" },
      )
      .annot(100, "center", "Highlight", {
        text: "Oh~la",
        width: 200,
        height: 14,
      })
      .endPage()
      .endPDF();
    writeOutput(end, "annotation-comment-highlight", bytes);
    var annotations = readAnnotations(end, bytes);
    assert.deepEqual(subtypes(annotations), ["Highlight"]);
    var [highlight] = annotations;
    assert.equal(highlight.Contents, "Oh~la");
    assert.deepEqual(highlight.C, [1, 1, 0]);
    assert.deepEqual(highlight.Rect, [100, 382, 300, 396]);
    assert.deepEqual(
      highlight.QuadPoints,
      [100, 396, 300, 396, 100, 382, 300, 382],
    );
  });
});
