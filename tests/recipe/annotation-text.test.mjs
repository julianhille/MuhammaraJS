import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import {
  pdfDateToTime,
  readAnnotations,
  subtypes,
} from "../support/annotations.mjs";

/**
 * An annotation color as 0..255 components.
 * @param {number[]} color - The /C entry, components from 0 to 1.
 * @returns {number[]} The components scaled to 0..255.
 */
function toBytes(color) {
  return color.map((part) => Math.round(part * 255));
}

/**
 * An ISO date at the whole second a PDF date keeps.
 * @param {string} date - The ISO date.
 * @returns {number} Milliseconds since the Unix epoch, whole seconds.
 */
function toSeconds(date) {
  return Math.floor(Date.parse(date) / 1000) * 1000;
}

var RICH_TEXT = [
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
].join("<br/>");

describeEnds("Annotation: Text Annotations", function (end) {
  it("adds highlights and text markup with their own text and colors", function () {
    var bytes = end
      .newRecipe()
      .createPage("letter")
      .annot(50, 50, "Highlight", {
        text: "Yo! I am a lonely Highlight",
        width: 100,
        height: 30,
        border: 10,
        color: [255, 128, 128],
      })
      .text("This text should be highlighted.", 50, 100, { font: "arial" })
      .annot(50, 100, "Highlight", {
        text: "Yes, it is.",
        width: 200,
        height: 18,
      })
      .circle(50, 150, 2, { stroke: "#3b7721" })
      .text("This text should be highlighted as well.", 50, 150, {
        font: "arial",
        highlight: true,
        size: 8,
      })
      .text("This text should be highlighted with custom value.", 50, 200, {
        font: "arial",
        highlight: {
          color: [12, 200, 128],
          text: "Is this a green highlight?",
        },
        size: 20,
      })
      .text("This text should be underlined with custom value.", 50, 250, {
        font: "arial",
        underline: {
          color: [255, 0, 128],
          text: "Underline!",
        },
        size: 30,
      })
      .text(
        "This text should be Squiggly underlined with custom value.",
        50,
        300,
        {
          font: "arial",
          squiggly: {
            color: [100, 0, 255],
            text: "Squiggly!",
          },
        },
      )
      .text("This text should be striked out with custom value.", 50, 350, {
        font: "arial",
        strikeOut: {
          color: [77, 77, 77],
          text: "StriketOut!",
        },
      })
      .text("This text should be striked out and highlighted.", 50, 400, {
        font: "arial",
        strikeOut: {
          color: [77, 77, 77],
          text: "StriketOut!",
        },
        highlight: {
          color: [255, 0, 0],
        },
        size: 25,
      })
      .endPage()
      .endPDF();
    writeOutput(end, "annotation-text-markup", bytes);
    var annotations = readAnnotations(end, bytes);
    assert.deepEqual(
      annotations.map((annotation) => ({
        subtype: annotation.Subtype,
        contents: annotation.Contents,
        color: toBytes(annotation.C),
      })),
      [
        {
          subtype: "Highlight",
          contents: "Yo! I am a lonely Highlight",
          color: [255, 128, 128],
        },
        { subtype: "Highlight", contents: "Yes, it is.", color: [255, 255, 0] },
        { subtype: "Highlight", contents: undefined, color: [255, 255, 0] },
        {
          subtype: "Highlight",
          contents: "Is this a green highlight?",
          color: [12, 200, 128],
        },
        { subtype: "Underline", contents: "Underline!", color: [255, 0, 128] },
        { subtype: "Squiggly", contents: "Squiggly!", color: [100, 0, 255] },
        { subtype: "StrikeOut", contents: "StriketOut!", color: [77, 77, 77] },
        { subtype: "StrikeOut", contents: "StriketOut!", color: [77, 77, 77] },
        { subtype: "Highlight", contents: undefined, color: [255, 0, 0] },
      ],
    );
    assert.deepEqual(annotations[0].Border, [0, 0, 10]);
    assert.deepEqual(annotations[0].Rect, [50, 712, 150, 742]);
    // Markup from text options starts where the text starts, on its line:
    // y 150 from the top of a 792-point page is PDF y 642.
    annotations.slice(2).forEach(function (annotation) {
      assert.equal(annotation.Rect[0], 50);
      assert.deepEqual(annotation.Border, [0, 0, 0]);
    });
    assert.ok(annotations[2].Rect[1] < 642 && annotations[2].Rect[3] > 634);
    // Two kinds of markup on one text cover the same area.
    assert.deepEqual(annotations[7].Rect, annotations[8].Rect);
  });

  it("highlights every line of a text box", function () {
    var textContent =
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum. " +
      "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).";
    var bytes = end
      .newRecipe()
      .createPage("letter")
      .text(textContent, "center", "center", {
        textBox: {
          width: 500,
          lineHeight: 30,
          minHeight: 300,
          textAlign: "center",
          padding: [15, 30, 30],
          style: {
            lineWidth: 5,
            stroke: "#ff0000",
            opacity: 0.3,
          },
        },
        font: "arial",
        color: "#813b00",
        align: "center center",
        highlight: {
          text: "highlight this paragraph",
        },
      })
      .endPage()
      .endPDF();
    writeOutput(end, "annotation-text-textbox", bytes);
    var annotations = readAnnotations(end, bytes);
    assert.ok(annotations.length > 10, `one highlight per line`);
    // The 500-point box is centered on the 612-point page, padded 30 left
    // and right; lines step down by the 30-point line height.
    annotations.forEach(function (annotation, index) {
      assert.equal(annotation.Subtype, "Highlight");
      assert.equal(annotation.Contents, "highlight this paragraph");
      var [left, bottom, right] = annotation.Rect;
      assert.ok(left >= 56 + 30 - 0.01 && right <= 556 - 30 + 0.01);
      if (index > 0) {
        assert.ok(
          Math.abs(annotations[index - 1].Rect[1] - bottom - 30) < 0.01,
          "lines are 30 points apart",
        );
      }
    });
  });

  it("adds replies to annotations", function () {
    var replies1 = [
      {
        subtype: "Text",
        text: "first reply to annotation 1",
        title: "Linus Torvalds",
        richText: false,
        flag: "",
        date: "2023-07-07T13:37:00.000Z",
        subject: "A subject 1",
      },
      {
        subtype: "Text",
        text: "second reply to annotation 1",
        title: "Greg Kroah-Hartman",
        richText: false,
        flag: "",
        date: "2023-07-07T06:40:48.090Z",
        subject: "A subject 2",
      },
      {
        subtype: "Text",
        text: "third reply to annotation 1",
        title: "Dirk Hohndel",
        richText: false,
        flag: "",
        date: "2023-07-07T06:42:21.090Z",
        subject: "A subject 3",
      },
    ];
    var replies2 = [
      {
        subtype: "Text",
        text: "first reply to annotation 2",
        title: "Junio C Hamano",
        richText: false,
        flag: "",
        date: "2023-07-10T08:44:32.090Z",
        subject: "A subject 10",
      },
      {
        subtype: "Text",
        text: "second reply to annotation 2",
        title: "Tejun Heo",
        richText: false,
        flag: "",
        date: "2023-07-10T08:50:12.090Z",
        subject: "A subject 11",
      },
    ];
    var replies3 = [
      {
        subtype: "Text",
        text: "another reply",
        title: "HCAI",
        richText: false,
        flag: "",
        date: "2023-09-07T11:45:32.090Z",
        subject: "Another subject",
      },
    ];
    var bytes = end
      .newRecipe()
      .createPage("letter")
      .annot(50, 50, "Highlight", {
        text: "Yo! I am a lonely Highlight. Annotation 1",
        width: 100,
        height: 30,
        border: 10,
        color: [255, 128, 128],
        title: "Ken Thompson",
        date: "2023-07-07T04:14:30.090Z",
        subject: "A subject 20",
        replies: replies1,
      })
      .text("This text should be highlighted.", 50, 100)
      .annot(50, 100, "Highlight", {
        text: "Yes, it is. Annotation 2",
        width: 200,
        height: 18,
        title: "Dennis Ritchie",
        date: "2023-07-09T18:36:50.090Z",
        subject: "A subject 21",
        replies: replies2,
      })
      .circle(50, 150, 2, { stroke: "#3b7721" })
      .text("This text should be highlighted as well.", 50, 150, {
        highlight: true,
        size: 8,
        title: "Brian Kernighan",
        date: "2023-07-10T05:15:32.090Z",
        subject: "A subject 22",
      })
      .text("This text should be highlighted with custom value.", 50, 200, {
        highlight: {
          color: [12, 200, 128],
          text: "Is this a green highlight?",
        },
        size: 20,
        title: "Bjarne Stroustrup",
        date: "2023-07-11T06:28:42.090Z",
        subject: "A subject 23",
      })
      .text("This text should be underlined with custom value.", 50, 250, {
        underline: {
          color: [255, 0, 128],
          text: "Underline!",
        },
        size: 30,
        title: "Guido van Rossum",
        date: "2023-07-12T07:14:45.090Z",
        subject: "A subject 24",
      })
      .text(
        "This text should be Squiggly underlined with custom value.",
        50,
        300,
        {
          underline: {
            color: [100, 0, 255],
            text: "Squiggly!",
          },
          title: "Richard Stallman",
          date: "2023-07-13T08:39:21.090Z",
          subject: "A subject 25",
        },
      )
      .text("This text should be striked out with custom value.", 50, 350, {
        strikeOut: {
          color: [77, 77, 77],
          text: "StrikedOut!",
        },
        title: "Gabe Newell",
        date: "2023-07-14T09:49:52.090Z",
        subject: "A subject 26",
      })
      .text(
        "This text should be striked out and highlighted. Does not have date",
        50,
        400,
        {
          strikeOut: {
            color: [77, 77, 77],
            text: "StrikedOut!",
          },
          highlight: {
            color: [255, 0, 0],
          },
          size: 25,
          title: "Evan You",
          subject: "A subject 27",
        },
      )
      .annot(50, 500, "Text", {
        text: RICH_TEXT,
        width: 100,
        height: 30,
        border: 10,
        color: [255, 128, 128],
        title: "Robert Fisher",
        open: true,
        richText: true,
        flag: "",
        icon: "Key",
        date: "2023-09-07T07:07:30.090Z",
        subject: "A subject 42",
        replies: replies3,
      })
      .endPage()
      .endPDF();
    writeOutput(end, "annotation-text-replies", bytes);
    var annotations = readAnnotations(end, bytes);
    /**
     * The annotation whose Contents is the given text.
     * @param {string} text - The Contents.
     * @returns {object} The annotation.
     */
    var byText = (text) =>
      annotations.find((annotation) => annotation.Contents === text);
    /**
     * Assert each reply answers its parent with its own metadata.
     * @param {object} parent - The parent annotation.
     * @param {object[]} replies - The reply options.
     * @returns {void}
     */
    var assertReplies = function (parent, replies) {
      replies.forEach(function (reply) {
        var written = byText(reply.text);
        assert.ok(written, `reply "${reply.text}" is written`);
        assert.equal(written.IRT, parent.id);
        assert.equal(written.RT, "R");
        assert.equal(written.T, reply.title);
        assert.equal(written.Subj, reply.subject);
        assert.equal(pdfDateToTime(written.M), toSeconds(reply.date));
      });
    };
    var first = byText("Yo! I am a lonely Highlight. Annotation 1");
    var second = byText("Yes, it is. Annotation 2");
    var rich = annotations.find((annotation) => annotation.RC);
    assertReplies(first, replies1);
    assertReplies(second, replies2);
    assertReplies(rich, replies3);
    assert.equal(first.T, "Ken Thompson");
    assert.equal(first.Subj, "A subject 20");
    assert.equal(pdfDateToTime(first.M), toSeconds("2023-07-07T04:14:30.090Z"));
    assert.equal(rich.Subtype, "Text");
    assert.equal(rich.Name, "Key");
    assert.equal(rich.Open, true);
    assert.equal(rich.T, "Robert Fisher");
    assert.match(rich.RC, /<b>Bold<\/b>/);
    // Markup from text options carries the text's metadata.
    var marked = annotations.filter(
      (annotation) => annotation.IRT === undefined,
    );
    assert.deepEqual(
      marked.map((annotation) => [annotation.Subtype, annotation.T]),
      [
        ["Highlight", "Ken Thompson"],
        ["Highlight", "Dennis Ritchie"],
        ["Highlight", "Brian Kernighan"],
        ["Highlight", "Bjarne Stroustrup"],
        ["Underline", "Guido van Rossum"],
        ["Underline", "Richard Stallman"],
        ["StrikeOut", "Gabe Newell"],
        ["StrikeOut", "Evan You"],
        ["Highlight", "Evan You"],
        ["Text", "Robert Fisher"],
      ],
    );
    // A missing date writes no /M.
    marked
      .filter((annotation) => annotation.T === "Evan You")
      .forEach((annotation) => assert.equal(annotation.M, undefined));
    assert.equal(subtypes(annotations).length, marked.length + 6);
  });

  // A reply takes the subtype of the annotation it answers, as documented on
  // both ends; its own subtype option is ignored.
  it("writes a reply with the subtype of the annotation it answers", function () {
    var bytes = end
      .newRecipe()
      .createPage("letter")
      .annot(50, 50, "Highlight", {
        text: "Annotation",
        width: 100,
        height: 30,
        replies: [{ subtype: "Text", text: "A reply" }],
      })
      .text("Marked text.", 50, 100, {
        font: "arial",
        underline: {
          text: "Underlined",
          replies: [{ subtype: "Text", text: "Also a reply" }],
        },
      })
      .endPage()
      .endPDF();
    writeOutput(end, "annotation-text-reply-subtype", bytes);
    var annotations = readAnnotations(end, bytes);
    assert.deepEqual(
      annotations.map((annotation) => [
        annotation.Subtype,
        annotation.Contents,
      ]),
      [
        ["Highlight", "Annotation"],
        ["Highlight", "A reply"],
        ["Underline", "Underlined"],
        ["Underline", "Also a reply"],
      ],
    );
  });
});
