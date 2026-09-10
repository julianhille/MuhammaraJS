const path = require("path");
const Recipe = require("@muhammara/native-with-source").Recipe;
const muhammara = require("@muhammara/native-with-source");
const assert = require("chai").assert;

describe("Create", () => {
  it("blank pdf", (done) => {
    const output = path.join(__dirname, "../output/blank.pdf");
    const recipe = new Recipe("new", output, {
      version: 1.6,
      author: "someone",
      title: "No title",
      subject: "Blank PDF",
      keywords: ["hummus", "js", "??", "234"],
    });
    recipe
      .custom("myValue", 123)
      .createPage()
      .endPage()
      .createPage()
      .endPage()
      .endPDF(done);
  });

  it("new pdf", (done) => {
    const output = path.join(__dirname, "../output/new.pdf");
    const recipe = new Recipe("new", output);
    const myCats = path.join(__dirname, "../TestMaterials/recipe/myCats.jpg");
    recipe
      // 1st Page
      .createPage("letter")
      .circle("center", 100, 30, { stroke: "#3b7721", fill: "#eee000" })
      .polygon(
        [
          [50, 250],
          [100, 200],
          [512, 200],
          [562, 250],
          [512, 300],
          [100, 300],
          [50, 250],
        ],
        {
          lineWidth: 5,
          stroke: [0, 0, 140],
          fill: [153, 143, 32],
          opacity: 0.2,
        },
      )
      .image(myCats, "center", 450, {
        width: 250,
        height: 250,
        opacity: 0.5,
        align: "center center",
      })
      .rectangle(240, 400, 50, 50, {
        color: [255, 0, 255],
        opacity: 0.2,
      })
      .rectangle(322, 400, 50, 50, {
        stroke: [0, 0, 140],
        width: 6,
      })
      .rectangle(240, 476, 50, 50, {
        fill: [255, 0, 0],
      })
      .rectangle(322, 476, 50, 50, {
        stroke: "#3b7721",
        fill: "#eee000",
        opacity: 0.2,
      })
      .moveTo(200, 600)
      .lineTo("center", 650)
      .lineTo(412, 600)
      .text("Welcome to Muhammara-Recipe", "center", 250, {
        color: "066099",
        fontSize: 30,
        bold: true,
        font: "Helvetica",
        align: "center center",
      })
      .text("some text box", 450, 400, {
        color: "066099",
        fontSize: 20,
        font: "Courier New",
        textBox: {
          width: 150,
          lineHeight: 16,
          padding: [5, 15],
          style: {
            lineWidth: 1,
            stroke: "#00ff00",
            fill: "#ff0000",
            dash: [20, 20],
            opacity: 0.1,
          },
        },
      })
      .comment("Feel free to open issues to help us!", "center", 100, {
        flag: "locked",
      })
      .endPage()
      // 2nd page
      .createPage("A4", 90)
      .circle(150, 150, 300, { fill: "#bbbbbb" })
      .rectangle(240, 400, 50, 50, {
        color: [255, 0, 255],
        opacity: 0.2,
      })
      .endPage()
      .endPDF(done);
  });

  it("tracks current-page rotation for named and explicit sizes", () => {
    const namedOutput = path.join(__dirname, "../output/rotate-named.pdf");
    const named = new Recipe("new", namedOutput)
      .createPage("letter", 90)
      .rotate(180)
      .endPage();
    assert.deepEqual(named.pageInfo(1), {
      width: 792,
      height: 612,
      rotate: 180,
      pageNumber: 1,
    });
    named.endPDF();

    const explicitOutput = path.join(
      __dirname,
      "../output/rotate-explicit.pdf",
    );
    const explicit = new Recipe("new", explicitOutput)
      .createPage(100, 200)
      .rotate(90)
      .endPage();
    assert.deepEqual(explicit.pageInfo(1), {
      width: 100,
      height: 200,
      rotate: 90,
      pageNumber: 1,
    });
    explicit.endPDF();

    [
      [namedOutput, 180],
      [explicitOutput, 90],
    ].forEach(([output, rotation]) => {
      const reader = muhammara.createReader(output);
      try {
        assert.equal(reader.parsePage(0).getRotate(), rotation);
      } finally {
        reader.end();
      }
    });
  });
});
