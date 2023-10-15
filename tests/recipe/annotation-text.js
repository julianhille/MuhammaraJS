const path = require("path");
const HummusRecipe = require("../../lib").Recipe;

describe("Annotation: Text Annotations", () => {
  it("Add a simple hightlight with text.", (done) => {
    const output = path.join(__dirname, "../output/annotation-text.pdf");
    const recipe = new HummusRecipe("new", output);
    recipe
      .createPage("letter-size")
      .annot(50, 50, "Highlight", {
        text: "Yo! I am a lonely Highlight",
        width: 100,
        height: 30,
        border: 10,
        color: [255, 128, 128],
      })
      .text("This text should be highlighted.", 50, 100)
      .annot(50, 100, "Highlight", {
        text: "Yes, it is.",
        width: 200,
        height: 18,
      })
      .circle(50, 150, 2, { stroke: "#3b7721" })
      .text("This text should be highlighted as well.", 50, 150, {
        highlight: true,
        size: 8,
      })
      .text("This text should be highlighted with custom value.", 50, 200, {
        highlight: {
          color: [12, 200, 128],
          text: "Is this a green highlight?",
        },
        size: 20,
      })
      .text("This text should be underlined with custom value.", 50, 250, {
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
          underline: {
            color: [100, 0, 255],
            text: "Squiggly!",
          },
        }
      )
      .text("This text should be striked out with custom value.", 50, 350, {
        strikeOut: {
          color: [77, 77, 77],
          text: "StriketOut!",
        },
      })
      .text("This text should be striked out and highlighted.", 50, 400, {
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
      .endPDF(done);
  });

  it("Add a highlight with text box.", (done) => {
    const output = path.join(
      __dirname,
      "../output/annotation-with-textbox.pdf"
    );
    const recipe = new HummusRecipe("new", output);
    const textContent =
      `${Date.now()} Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum. ` +
      "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).";
    recipe
      .createPage("letter-size")
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
        font: "Helvetica",
        color: "#813b00",
        align: "center center",
        highlight: {
          text: "highlight this paragraph",
        },
      })
      .endPage()
      .endPDF(done);
  });

  it("Add annotation replies to annotations.", (done) => {
    const output = path.join(__dirname, "../output/annotation-replies.pdf");
    const recipe = new HummusRecipe("new", output);

    const replies1 = [
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

    const replies2 = [
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

    const replies3 = [
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

    const richText = [
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

    recipe
      .createPage("letter-size")
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
        }
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
        }
      )
      .annot(50, 500, "Text", {
        text: richText,
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
      .endPDF(done);
  });
});
