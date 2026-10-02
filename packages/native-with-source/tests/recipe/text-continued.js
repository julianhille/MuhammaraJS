const path = require("path");
const { expect } = require("chai");
const muhammara = require("@muhammara/native-with-source");
const Recipe = muhammara.Recipe;

/**
 * Lists the text runs drawn on a page, in drawing order.
 * @param {string} file - The PDF file.
 * @param {number} [pageIndex=0] - The page index.
 * @returns {Array<{text: string, x: number, y: number, color: string}>} The runs with their
 *   text-matrix position in PDF points and fill color.
 */
function drawnRuns(file, pageIndex = 0) {
  const reader = muhammara.createReader(file);
  try {
    const page = reader.parsePage(pageIndex).getDictionary();
    const contents = reader.queryDictionaryObject(page, "Contents");
    const streams =
      contents.getType() === muhammara.ePDFObjectArray
        ? contents
            .toPDFArray()
            .toJSArray()
            .map((entry) =>
              reader
                .parseNewObject(
                  entry.toPDFIndirectObjectReference().getObjectID(),
                )
                .toPDFStream(),
            )
        : [contents.toPDFStream()];
    const content = streams
      .map((stream) => {
        const readStream = reader.startReadingFromStream(stream);
        let text = "";
        while (readStream.notEnded()) {
          text += Buffer.from(readStream.read(4096)).toString("latin1");
        }
        return text;
      })
      .join("\n");
    return [
      ...content.matchAll(
        /(-?[\d.]+) (-?[\d.]+) Tm[^()<>]*?(?:\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f]*)>) Tj/g,
      ),
    ].map((match) => ({
      text:
        match[3]?.replace(/\\(.)/g, "$1") ??
        Buffer.from(match[4], "hex").toString("latin1"),
      x: Number(match[1]),
      y: Number(match[2]),
      // The last fill color set before the run.
      color: content
        .slice(0, match.index)
        .match(/[^]*\s(\S+ \S+ \S+) rg\s/)?.[1],
    }));
  } finally {
    reader.end();
  }
}

/**
 * Draws on one 400 x 400 page and returns the runs it drew.
 * @param {string} name - Output file name without extension.
 * @param {function(Recipe): void} draw - Draws on the page.
 * @returns {Array<{text: string, x: number, y: number}>} The drawn runs.
 */
function drawRuns(name, draw) {
  const output = path.join(__dirname, `../output/${name}.pdf`);
  const recipe = new Recipe("new", output);
  recipe.createPage(400, 400);
  draw(recipe);
  recipe.endPage();
  recipe.endPDF();
  return drawnRuns(output);
}

describe("Text - Continued", () => {
  it("Simple text segmentation", (done) => {
    const output = path.join(__dirname, "../output/continued-text.pdf");
    const recipe = new Recipe("new", output);
    const lorem =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. \
Etiam in suscipit purus. Vestibulum ante ipsum primis in faucibus orci luctus \
et ultrices posuere cubilia Curae; Vivamus nec hendrerit felis. Morbi aliquam \
facilisis risus eu lacinia. Sed eu leo in turpis fringilla hendrerit. \
Ut nec accumsan nisl. Suspendisse rhoncus nisl posuere tortor tempus et dapibus \
elit porta. Cras leo neque, elementum a rhoncus ut, vestibulum non nibh. \
Phasellus pretium justo turpis. Etiam vulputate, odio vitae tincidunt ultricies, \
eros odio dapibus nisi, ut tincidunt lacus arcu eu elit. Aenean velit erat, vehicula \
eget lacinia ut, dignissim non tellus. Aliquam nec lacus mi, sed vestibulum nunc. \
Suspendisse potenti. Curabitur vitae sem turpis. Vestibulum sed neque eget dolor dapibus \
porttitor at sit amet sem. Fusce a turpis lorem. Vestibulum ante ipsum primis in \
faucibus orci luctus et ultrices posuere cubilia Curae;";

    let x = 72;
    let y = 52;
    recipe
      .createPage("letter")
      .line(
        [
          [540, 10],
          [540, 300],
        ],
        { lineWidth: 0.5 },
      )
      .line(
        [
          [72, 72],
          [560, 72],
        ],
        { lineWidth: 0.5 },
      )
      .text(lorem.slice(0, 500), {
        rotation: 0,
        opacity: 1,
        textBox: { textAlign: "justify" },
      })
      .text(lorem.slice(500, 510), { color: "red", hilite: true })
      .text(lorem.slice(510), { color: "green", hilite: false })
      .text("", { flow: false })
      .text(
        "Simple Text Flow, 3 segments, showing color change and hilite",
        x,
        y,
        { color: "#000000" },
      );

    x = 72;
    y = 300;
    let w = 200;
    let p = 4;
    recipe
      .text(`This is a text box with a padding of ${p}, `, x, y, {
        flow: true,
        hilite: true,
        textBox: { padding: p, width: w, textAlign: "center" },
      })
      .text("with round box corners (standard radius is 5) ", {
        color: "red",
        hilite: false,
      })
      .movedown(2)
      .text("Did a movedown(2) to get ", { color: "blue", hilite: true })
      .text(
        'text to this spot in box. Notice the text hiliting, which is different from "fill" for the text box. ',
        { color: "green", size: 14 },
      )
      .text(
        "It can have different colors, with yellow being the default at opacity .5. See blue higlight below",
      )
      .movedown(2)
      .text(
        "Box was constructed with multiple text statements without specifying any x,y coordinates. ",
        { color: "blue", hilite: { color: "#81e6ff" } },
      )
      .movedown()
      .text("Notice, here is a change in font size. ", {
        size: 20,
        color: "#ff00ff",
        hilite: false,
      })
      .text("", {
        flow: false,
        textBox: { style: { lineWidth: 1, stroke: "red", borderRadius: true } },
      });

    recipe
      .text("We can still handle rotation along", 350, y + 75, {
        hilite: { opacity: 0.9 },
        rotation: -30,
        flow: true,
        textBox: {
          padding: 5,
          width: 100,
          textAlign: "center",
          style: { stroke: "black", fill: "#9de3f2", borderRadius: true },
        },
      })
      .text("with text background fill coloring, and text centering.", {
        hilite: false,
      })
      .text("", { flow: false });

    recipe.endPage();
    recipe.endPDF(done);
  });

  // Issue #888: the Wasm Recipe mirrors these flow assertions in
  // packages/wasm/tests/recipe/text-continued.test.mjs.
  describe("flow", () => {
    const flowOptions = { flow: true, font: "arial", textBox: { width: 300 } };

    it("continues a flowed run on the line where the previous one ended", () => {
      let helloAdvance;
      const runs = drawRuns("continued-flow-line", (recipe) => {
        const extent = (text) => recipe.textDimensions(text, flowOptions).xMax;
        helloAdvance = extent("Hello world") - extent("world");
        recipe
          .text("Hello ", 20, 20, flowOptions)
          .text("world again", flowOptions)
          .text("", { flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal([
        "Hello ",
        "world again",
      ]);
      expect(runs[0].x).to.be.closeTo(20, 0.01);
      expect(runs[1].y).to.equal(runs[0].y);
      // The space that ends a run separates it from the next one.
      expect(runs[1].x).to.be.at.least(runs[0].x + helloAdvance - 0.01);
    });

    it("keeps runs without a space between them together", () => {
      const runs = drawRuns("continued-flow-no-space", (recipe) => {
        recipe
          .text("Hello", 20, 20, flowOptions)
          .text("world", flowOptions)
          .text("", { flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal(["Hello", "world"]);
      expect(runs[1].y).to.equal(runs[0].y);
      expect(runs[1].x).to.be.above(runs[0].x);
    });

    it("keeps each run's own style when a later run changes it", () => {
      const runs = drawRuns("continued-flow-run-style", (recipe) => {
        recipe
          .text("Plain ", 20, 20, flowOptions)
          .text("red", { color: "#ff0000" })
          .text("", { flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal(["Plain ", "red"]);
      expect(runs[1].color).to.equal("1 0 0");
      expect(runs[0].color).to.not.equal("1 0 0");
    });

    it("measures each run's character spacing when wrapping a flow", () => {
      const runs = drawRuns("continued-flow-char-space", (recipe) => {
        recipe
          .text("Spaced letters wrap the same ", 20, 20, {
            flow: true,
            font: "arial",
            charSpace: 3,
            textBox: { width: 150 },
          })
          .text("way in a flow as in one call.", {})
          .text("", { flow: false });
      });
      // Native's line breaks for the same text in a single text() call.
      expect(runs.map((run) => run.text.trim())).to.deep.equal([
        "Spaced letters",
        "wrap the same",
        "way in a flow as",
        "in one call.",
      ]);
    });

    it("wraps flowed runs together inside the shared text box", () => {
      const runs = drawRuns("continued-flow-wrap", (recipe) => {
        recipe
          .text("Hello ", 20, 20, {
            flow: true,
            font: "arial",
            textBox: { width: 80 },
          })
          .text("world again and again and again", { flow: true })
          .text("", { flow: false });
      });
      expect(runs[0].text).to.equal("Hello ");
      expect(runs[1].text).to.equal("world");
      expect(runs[1].y).to.equal(runs[0].y);
      const wrapped = runs.slice(2);
      expect(wrapped.map((run) => run.text.trim())).to.deep.equal([
        "again and",
        "again and",
        "again",
      ]);
      wrapped.forEach((run, index) => {
        expect(run.x).to.be.closeTo(20, 0.01);
        expect(run.y).to.be.below(index ? wrapped[index - 1].y : runs[0].y);
      });
    });

    it("continues the flow in calls without coordinates until flow: false", () => {
      const runs = drawRuns("continued-flow-default", (recipe) => {
        recipe
          .text("Hello ", 20, 20, flowOptions)
          .text("world ", {})
          .text("end", { flow: false })
          .text("Next box", 20, 100, { font: "arial" });
      });
      expect(runs.map((run) => run.text.trim())).to.deep.equal([
        "Hello",
        "world",
        "end",
        "Next box",
      ]);
      expect(runs[1].y).to.equal(runs[0].y);
      expect(runs[2].y).to.equal(runs[0].y);
      expect(runs[2].x).to.be.above(runs[1].x);
      expect(runs[3].x).to.be.closeTo(20, 0.01);
      expect(runs[3].y).to.be.below(runs[0].y - 60);
    });

    it("aligns the runs of one line as one line", () => {
      const runs = drawRuns("continued-flow-center", (recipe) => {
        recipe
          .text("Hello ", 20, 20, {
            flow: true,
            font: "arial",
            textBox: { width: 300, textAlign: "center" },
          })
          .text("world", {})
          .text("", { flow: false });
      });
      expect(runs[1].y).to.equal(runs[0].y);
      // Centering "Hello world" in a 300pt box starts it near x = 135.
      expect(runs[0].x).to.be.within(120, 160);
      expect(runs[1].x).to.be.above(runs[0].x + 25);
    });

    it("keeps the spaces that start a flowed line", () => {
      const start = drawRuns("continued-flow-leading-space", (recipe) => {
        recipe
          .text("   Indented", 50, 50, flowOptions)
          .text("", { flow: false });
      });
      expect(start.map((run) => run.text)).to.deep.equal(["   Indented"]);
      const runs = drawRuns("continued-flow-leading-space-line", (recipe) => {
        recipe
          .text("Line one", 50, 50, flowOptions)
          .movedown()
          .text("   Again", {})
          .text("", { flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal([
        "Line one",
        "   Again",
      ]);
      expect(runs[1].y).to.be.below(runs[0].y);
    });

    it("rejects an invalid run at its call and keeps the flow", () => {
      const runs = drawRuns("continued-flow-invalid-run", (recipe) => {
        recipe.text("x", 20, 20, flowOptions);
        expect(() => recipe.text("y", { charSpace: Infinity })).to.throw(
          TypeError,
          "charSpace must be a finite number",
        );
        recipe.text("z", { flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal(["x", "z"]);
      expect(runs[1].y).to.equal(runs[0].y);
    });

    it("moves a flow down a whole line with movedown()", () => {
      let coords;
      const runs = drawRuns("continued-flow-movedown", (recipe) => {
        recipe.text("Hello", 20, 20, flowOptions);
        // The flow is laid out when it ends, so this is still its origin.
        coords = recipe.movedown(1, true);
        recipe
          .text("world", {})
          .movedown(2)
          .text("again", {})
          .text("", { flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal([
        "Hello",
        "world",
        "again",
      ]);
      runs.forEach((run) => expect(run.x).to.be.closeTo(20, 0.01));
      const lineHeight = runs[0].y - runs[1].y;
      expect(lineHeight).to.be.above(10);
      expect(coords).to.deep.equal([20, 20]);
      expect(runs[1].y - runs[2].y).to.be.closeTo(2 * lineHeight, 0.01);
    });
  });
});
