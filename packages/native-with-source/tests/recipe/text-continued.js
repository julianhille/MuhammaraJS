const fs = require("fs");
const path = require("path");
const { expect } = require("chai");
const muhammara = require("@muhammara/native-with-source");
const Recipe = muhammara.Recipe;

/**
 * Reads a page's content streams as one string.
 * @param {string} file - The PDF file.
 * @param {number} [pageIndex=0] - The page index.
 * @returns {string} The decoded page content.
 */
function pageContent(file, pageIndex = 0) {
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
    return streams
      .map((stream) => {
        const readStream = reader.startReadingFromStream(stream);
        let text = "";
        while (readStream.notEnded()) {
          text += Buffer.from(readStream.read(4096)).toString("latin1");
        }
        return text;
      })
      .join("\n");
  } finally {
    reader.end();
  }
}

/**
 * Lists the text runs drawn on a page, in drawing order.
 * @param {string} file - The PDF file.
 * @param {number} [pageIndex=0] - The page index.
 * @returns {Array<{text: string, x: number, y: number, color: string}>} The runs with their
 *   text-matrix position in PDF points and fill color.
 */
function drawnRuns(file, pageIndex = 0) {
  const content = pageContent(file, pageIndex);
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
    color: content.slice(0, match.index).match(/[^]*\s(\S+ \S+ \S+) rg\s/)?.[1],
  }));
}

/**
 * Where native places the run after a run: at its right edge, plus the width
 * of an "o" when it ends with a space.
 * @param {Recipe} recipe - Recipe that measures.
 * @param {string} text - The run before.
 * @param {Object} options - Its options.
 * @returns {number} The distance between the two runs' starts.
 */
function runAdvance(recipe, text, options) {
  return (
    recipe.textDimensions(text, options).xMax +
    (text.endsWith(" ") ? recipe.textDimensions("o", options).width : 0)
  );
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
        helloAdvance = runAdvance(recipe, "Hello ", flowOptions);
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
      expect(runs[1].x).to.be.closeTo(runs[0].x + helloAdvance, 0.01);
    });

    it("places a right-aligned line's runs as a left-aligned line's", () => {
      let helloAdvance;
      const runs = drawRuns("continued-flow-right", (recipe) => {
        helloAdvance = runAdvance(recipe, "Hello ", flowOptions);
        recipe
          .text("Hello ", 20, 20, {
            ...flowOptions,
            textBox: { width: 300, textAlign: "right" },
          })
          .text("world", {})
          .text("", { flow: false });
      });
      expect(runs[1].x - runs[0].x).to.be.closeTo(helloAdvance, 0.01);
    });

    it("puts runs of different sizes on one baseline inside the box", () => {
      let bigAscent;
      const runs = drawRuns("continued-flow-sizes", (recipe) => {
        bigAscent = recipe.textDimensions("Big", {
          font: "arial",
          size: 20,
        }).yMax;
        recipe
          .text("Small ", 20, 20, { flow: true, font: "arial", size: 10 })
          .text("Big", { size: 20 })
          .text("", { flow: false });
      });
      expect(runs[1].y).to.equal(runs[0].y);
      // The box starts 20 points below the top of the 400-point page.
      expect(runs[1].y + bigAscent).to.be.at.most(380.01);
    });

    it("sizes each line of a flow by its own runs", () => {
      const flowRuns = drawRuns("continued-flow-line-heights", (recipe) => {
        recipe
          .text("Small small small ", 20, 20, {
            flow: true,
            font: "arial",
            size: 10,
            textBox: { width: 90 },
          })
          .text("Big", { size: 20 })
          .text("", { flow: false });
      });
      const plainRuns = drawRuns(
        "continued-flow-line-heights-plain",
        (recipe) => {
          recipe.text("Small small small", 20, 20, { font: "arial", size: 10 });
        },
      );
      expect(flowRuns[0].y).to.equal(plainRuns[0].y);
      expect(flowRuns[1].y).to.be.below(flowRuns[0].y);

      // Runs without visible text do not size a line that has text: an
      // empty run, or the space before a word that wraps.
      const small = {
        flow: true,
        font: "arial",
        size: 10,
        textBox: { width: 90 },
      };
      const empty = drawRuns("continued-flow-line-heights-empty", (recipe) => {
        recipe
          .text("Small small small", 20, 20, small)
          .text("", { size: 20, flow: false });
      });
      const space = drawRuns("continued-flow-line-heights-space", (recipe) => {
        recipe
          .text("Small small small", 20, 20, small)
          .text(" Big", { size: 20, flow: false });
      });
      expect(empty[0].y).to.equal(plainRuns[0].y);
      expect(space.map((run) => run.text)).to.deep.equal([
        "Small small small",
        "Big",
      ]);
      expect(space[0].y).to.equal(plainRuns[0].y);
    });

    it("moves down the full height of a line with mixed sizes", () => {
      let mixedCoords;
      let bigCoords;
      drawRuns("continued-flow-mixed-movedown", (recipe) => {
        recipe
          .text("Small ", 20, 20, { flow: true, font: "arial", size: 10 })
          .text("Big", { size: 20 })
          .text("", { flow: false });
        mixedCoords = recipe.movedown(1, true);
      });
      drawRuns("continued-flow-big-movedown", (recipe) => {
        recipe.text("Big", 20, 20, { font: "arial", size: 20 });
        bigCoords = recipe.movedown(1, true);
      });
      expect(mixedCoords).to.deep.equal(bigCoords);
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

    it("rotates only the runs that set rotation", () => {
      /**
       * Draws a flow and counts the 30 degree rotations on its page.
       * @param {string} name - Output file name without extension.
       * @param {function(Recipe): void} draw - Draws the flow.
       * @returns {number} The number of rotation matrices.
       */
      const rotations = (name, draw) => {
        const output = path.join(__dirname, `../output/${name}.pdf`);
        const recipe = new Recipe("new", output);
        recipe.createPage(400, 400);
        draw(recipe);
        recipe.endPage();
        recipe.endPDF();
        return (
          pageContent(output).match(
            /0\.866025 -?0\.5 -?0\.5 0\.866025 \S+ \S+ cm/g,
          )?.length ?? 0
        );
      };
      expect(
        rotations("continued-flow-rotated-run", (recipe) => {
          recipe
            .text("Plain ", 20, 20, flowOptions)
            .text("turned ", { rotation: 30 })
            .text("plain", { rotation: 0, flow: false });
        }),
      ).to.equal(1);
      expect(
        rotations("continued-flow-rotated-end", (recipe) => {
          recipe
            .text("Plain ", 20, 20, flowOptions)
            .text("more ", {})
            .text("turned", { rotation: 30, flow: false });
        }),
      ).to.equal(1);
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

      // Fitting a run counts the space after every run before it that ends
      // with one, as drawing does.
      const spaced = drawRuns("continued-flow-wrap-spaces", (recipe) => {
        recipe
          .text("alpha ", 20, 20, { ...flowOptions, textBox: { width: 120 } })
          .text("bravo ", {})
          .text("charlie delta", { flow: false });
      });
      expect(spaced.map((run) => run.text)).to.deep.equal([
        "alpha ",
        "bravo",
        "charlie delta",
      ]);
      expect(spaced[2].x).to.be.closeTo(20, 0.01);
      expect(spaced[2].y).to.be.below(spaced[0].y);

      // A wrapped line starts with its first word, without the spaces that
      // start its run, and the line before it ends without its spaces.
      const leading = drawRuns(
        "continued-flow-wrap-leading-space",
        (recipe) => {
          recipe
            .text("foxtrot", 20, 20, {
              ...flowOptions,
              size: 23,
              textBox: { width: 114 },
            })
            .text("hotel ", {})
            .text(" charlie", {})
            .text("", { flow: false });
        },
      );
      expect(leading.map((run) => run.text)).to.deep.equal([
        "foxtrot",
        "hotel",
        "charlie",
      ]);
      expect(leading[2].x).to.be.closeTo(20, 0.01);
      const centered = drawRuns("continued-flow-wrap-center", (recipe) => {
        recipe
          .text("juliet", 20, 20, {
            ...flowOptions,
            size: 18,
            textBox: { width: 113, textAlign: "center" },
          })
          .text(" delta ", {})
          .text(" mike lima", {})
          .text("", { flow: false });
      });
      expect(centered.map((run) => run.text)).to.deep.equal([
        "juliet",
        " delta",
        "mike lima",
      ]);
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

    it("gives every gap of a justified line one width across run sizes", () => {
      const ends = {};
      const runs = drawRuns("continued-flow-justify-sizes", (recipe) => {
        const big = { font: "arial", size: 25 };
        const small = { font: "arial", size: 8 };
        ["golf", "lima"].forEach((word) => {
          ends[`${word} `] = recipe.textDimensions(`${word} `, big).xMax;
        });
        ["fox", "delta", "papa", "kilo", "romeo", "oscar"].forEach((word) => {
          ends[`${word} `] = recipe.textDimensions(`${word} `, small).xMax;
        });
        // The line's last word is drawn without its space.
        ends.oscar = recipe.textDimensions("oscar", small).xMax;
        recipe
          .text("golf lima ", 18, 24, {
            ...big,
            flow: true,
            textBox: { width: 220, textAlign: "justify" },
          })
          .text("fox delta papa kilo romeo oscar charlie", {
            size: 8,
            flow: false,
          });
      });
      const line = runs.filter((run) => run.y === runs[0].y);
      expect(line.map((run) => run.text.trim())).to.deep.equal([
        "golf",
        "lima",
        "fox",
        "delta",
        "papa",
        "kilo",
        "romeo",
        "oscar",
      ]);
      const gaps = line
        .slice(1)
        .map((run, index) => run.x - line[index].x - ends[line[index].text]);
      gaps.forEach((gap) => expect(gap).to.be.closeTo(gaps[0], 0.01));
      const last = line[line.length - 1];
      expect(last.x + ends[last.text]).to.be.closeTo(18 + 220, 0.01);
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

      // A rejected call that would end the flow leaves it open.
      const open = drawRuns("continued-flow-invalid-end", (recipe) => {
        recipe.text("x", 20, 20, flowOptions);
        expect(() => recipe.text("y", { size: -1, flow: false })).to.throw(
          RangeError,
          "Text size must be a number greater than zero, received -1",
        );
      });
      expect(open.map((run) => run.text)).to.deep.equal(["x"]);
    });

    it("keeps the flow open when a call with coordinates is rejected", () => {
      const runs = drawRuns("continued-flow-invalid-positioned", (recipe) => {
        recipe.text("x ", 20, 20, flowOptions);
        expect(() =>
          recipe.text("y", 20, 100, { ...flowOptions, charSpace: Infinity }),
        ).to.throw(TypeError, "charSpace must be a finite number");
        expect(() =>
          recipe.text("y", 20, 100, { ...flowOptions, size: -1 }),
        ).to.throw(
          RangeError,
          "Text size must be a number greater than zero, received -1",
        );
        expect(() =>
          recipe.text("y", 20, 100, { ...flowOptions, rotation: NaN }),
        ).to.throw(TypeError, "rotation must be a finite number");
        recipe.text("z", { flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal(["x ", "z"]);
      expect(runs[1].y).to.equal(runs[0].y);
      expect(runs[1].x).to.be.above(runs[0].x);
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

      // A movedown() that ends the flow moves the next text below its lines.
      const after = drawRuns("continued-flow-movedown-end", (recipe) => {
        recipe
          .text("Hello", 20, 20, flowOptions)
          .movedown(2)
          .text("", { flow: false })
          .text("again", { font: "arial", flow: false });
      });
      expect(after[0].y - after[1].y).to.be.closeTo(2 * lineHeight, 0.01);
    });

    it("measures an empty flow with its own font", () => {
      const recipe = new Recipe(
        "new",
        path.join(__dirname, "../output/continued-flow-empty.pdf"),
      );
      recipe.createPage(400, 400);
      recipe
        .text("", 20, 20, { flow: true, font: "arial", size: 30 })
        .text("", { flow: false });
      const flowY = recipe.movedown(0, true)[1];
      recipe.text("", 20, 20, { font: "arial", size: 30 });
      expect(flowY).to.equal(recipe.movedown(0, true)[1]);
      recipe.endPage();
      recipe.endPDF();
    });

    it("starts the line of an empty flow with the next run", () => {
      const runs = drawRuns("continued-flow-empty-start", (recipe) => {
        recipe
          .text("", 20, 20, flowOptions)
          .text("Hello", {})
          .text("", { flow: false })
          .text("Hello", 200, 20, { font: "arial" });
      });
      expect(runs.map((run) => run.text)).to.deep.equal(["Hello", "Hello"]);
      expect(runs[0].y).to.equal(runs[1].y);

      // Nor does the empty run's size place that line.
      [
        [28, 14],
        [14, 28],
      ].forEach(([emptySize, size]) => {
        const sized = drawRuns(
          `continued-flow-empty-start-${emptySize}`,
          (recipe) => {
            recipe
              .text("", 20, 20, { ...flowOptions, size: emptySize })
              .text("Hello", { size })
              .text("", { flow: false })
              .text("Hello", 200, 20, { font: "arial", size });
          },
        );
        expect(sized[0].y).to.equal(sized[1].y);
      });
    });

    // Issue #889: no flowed text is dropped.
    it("draws a flow that never ends when the page ends", () => {
      const runs = drawRuns("continued-flow-unended", (recipe) => {
        recipe.text("Hello ", 20, 20, flowOptions).text("world", {});
      });
      expect(runs.map((run) => run.text)).to.deep.equal(["Hello ", "world"]);
      expect(runs[1].y).to.equal(runs[0].y);
    });

    it("links only a linked run's text when the page ends the flow", () => {
      const output = path.join(__dirname, "../output/continued-flow-link.pdf");
      const recipe = new Recipe("new", output);
      recipe
        .createPage(400, 400)
        .text("Hello ", 20, 20, flowOptions)
        .text("world", { link: "https://example.com" })
        .endPage()
        .endPDF();
      const rects = [
        ...fs
          .readFileSync(output, "latin1")
          .matchAll(/\/Subtype \/Link[^]*?\/Rect \[([^\]]*)\]/g),
      ].map((match) => match[1].trim().split(/\s+/).map(Number));
      expect(rects).to.have.lengthOf(1);
      expect(rects[0][2]).to.be.above(rects[0][0]);
    });

    it("draws an open flow before a call with coordinates", () => {
      const runs = drawRuns("continued-flow-then-positioned", (recipe) => {
        recipe
          .text("Hello ", 20, 20, flowOptions)
          .text("world", {})
          .text("next", 20, 100, { font: "arial" });
      });
      expect(runs.map((run) => run.text)).to.deep.equal([
        "Hello ",
        "world",
        "next",
      ]);
      expect(runs[1].y).to.equal(runs[0].y);
      expect(runs[2].y).to.be.below(runs[0].y - 50);
    });

    it("draws an open flow before a table", () => {
      const runs = drawRuns("continued-flow-then-table", (recipe) => {
        recipe
          .text("Hello ", 20, 20, flowOptions)
          .text("world", {})
          .table(20, 100, [{ cell: "cell" }], {
            columns: [{ name: "cell", text: "head", width: 80 }],
          });
      });
      expect(runs.slice(0, 2).map((run) => run.text)).to.deep.equal([
        "Hello ",
        "world",
      ]);
      expect(runs[1].y).to.equal(runs[0].y);
      expect(runs.some((run) => run.text === "cell")).to.equal(true);
    });

    it("draws an HTML flow that is not ended", () => {
      const runs = drawRuns("continued-flow-html-unended", (recipe) => {
        recipe.text("<b>Hello</b> world", 20, 20, {
          ...flowOptions,
          html: true,
        });
      });
      expect(runs.map((run) => run.text)).to.deep.equal(["Hello", " world"]);
    });

    it("continues the line with HTML runs and ends after them", () => {
      const runs = drawRuns("continued-flow-html-runs", (recipe) => {
        recipe
          .text("Plain ", 20, 20, flowOptions)
          .text("<b>bold</b> ", { html: true })
          .text("<i>italic</i>", {})
          .text("", { flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal([
        "Plain ",
        "bold",
        " ",
        "italic",
      ]);
      runs.forEach((run) => expect(run.y).to.equal(runs[0].y));

      // An HTML run that ends the flow keeps the space between its elements.
      let spaceAdvance;
      const ended = drawRuns("continued-flow-html-runs-ended", (recipe) => {
        spaceAdvance = runAdvance(recipe, " ", flowOptions);
        recipe
          .text("Plain ", 20, 20, flowOptions)
          .text("<b>bold</b> <i>italic</i>", { html: true, flow: false });
      });
      expect(ended.map((run) => run.text)).to.deep.equal([
        "Plain ",
        "bold",
        " ",
        "italic",
      ]);
      expect(ended[3].x - ended[2].x).to.be.closeTo(spaceAdvance, 0.01);

      // HTML without text keeps the runs before it, also when it ends the flow.
      const empty = drawRuns("continued-flow-html-runs-empty", (recipe) => {
        recipe
          .text("Plain ", 20, 20, flowOptions)
          .text("<i></i>", { html: true })
          .text("end", { html: false })
          .text("<p></p>", { html: true, flow: false });
      });
      expect(empty.map((run) => run.text)).to.deep.equal(["Plain ", "end"]);
      expect(empty[1].y).to.equal(empty[0].y);

      // Elements with the same styles stay runs of their own.
      const spans = drawRuns("continued-flow-html-spans", (recipe) => {
        recipe
          .text("<span>kilo</span> <span>lima</span>", 20, 20, {
            ...flowOptions,
            html: true,
          })
          .text("", { flow: false });
      });
      expect(spans.map((run) => run.text)).to.deep.equal(["kilo", " ", "lima"]);
    });

    it("moves an empty flow down with movedown()", () => {
      const runs = drawRuns("continued-flow-empty-movedown", (recipe) => {
        recipe
          .text("Hello", 20, 20, flowOptions)
          .text("", {})
          .movedown()
          .text("A", {})
          .text("", { flow: false })
          .text("", 20, 100, flowOptions)
          .movedown()
          .text("B", {})
          .text("", { flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal(["Hello", "A", "B"]);
      expect(runs[1].y).to.be.below(runs[0].y);
      // B is one line below the empty line that starts 80pt below Hello's.
      expect(runs[0].y - runs[2].y).to.be.closeTo(
        80 + runs[0].y - runs[1].y,
        0.01,
      );
    });

    it("ends the line with movedown(0)", () => {
      const runs = drawRuns("continued-flow-movedown-zero", (recipe) => {
        recipe
          .text("Hello ", 20, 20, flowOptions)
          .movedown(0)
          .text("world", {})
          .text("", { flow: false });
      });
      expect(runs[1].y).to.be.below(runs[0].y);
      expect(runs[1].x).to.be.closeTo(20, 0.01);
    });

    it("moves down below a flow whose last line is the tallest", () => {
      const runs = drawRuns("continued-flow-taller-last-line", (recipe) => {
        recipe
          .text("small", 20, 20, { flow: true, font: "arial", size: 10 })
          .movedown()
          .text("BIG", { size: 30 })
          .text("", { flow: false })
          .movedown()
          .text("next", { font: "arial", size: 10, flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal([
        "small",
        "BIG",
        "next",
      ]);
      // "next" starts below the baseline of the 30-point line.
      expect(runs[2].y).to.be.below(runs[1].y - 5);
    });

    it("keeps the cursor out of a box's vertical alignment", () => {
      const aligned = drawRuns("continued-cursor-vertical-align", (recipe) => {
        recipe
          .text("A\nB", 20, 20, {
            font: "arial",
            textBox: { width: 100, height: 100, textAlign: "left center" },
          })
          .text("next", { font: "arial", flow: false });
      });
      const plain = drawRuns("continued-cursor-no-align", (recipe) => {
        recipe
          .text("A\nB", 20, 20, { font: "arial", textBox: { width: 100 } })
          .text("next", { font: "arial", flow: false });
      });
      expect(aligned[2].y).to.equal(plain[2].y);
    });

    it("keeps the spaces between runs in the middle of a flow", () => {
      let oneAdvance;
      let twoAdvance;
      const runs = drawRuns("continued-flow-middle-spaces", (recipe) => {
        oneAdvance = runAdvance(recipe, "one ", flowOptions);
        twoAdvance = runAdvance(recipe, "two ", flowOptions);
        recipe
          .text("one ", 20, 20, flowOptions)
          .text("two ", {})
          .text("   ", {})
          .text("three", {})
          .text("", { flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal([
        "one ",
        "two ",
        "   ",
        "three",
      ]);
      expect(runs[1].x - runs[0].x).to.be.closeTo(oneAdvance, 0.01);
      expect(runs[2].x - runs[1].x).to.be.closeTo(twoAdvance, 0.01);
      expect(runs[3].x).to.be.above(runs[2].x);
    });

    it("ends the line at line breaks that end a run", () => {
      const runs = drawRuns("continued-flow-trailing-breaks", (recipe) => {
        recipe
          .text("Hello\n", 20, 20, flowOptions)
          .text("world ", {})
          .text("\n\n", {})
          .text("again", {})
          .text("", { flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal([
        "Hello",
        "world",
        "again",
      ]);
      const lineHeight = runs[0].y - runs[1].y;
      expect(runs[1].x).to.equal(runs[0].x);
      expect(runs[1].y - runs[2].y).to.be.closeTo(2 * lineHeight, 0.01);

      // HTML line breaks and line feeds end the line the same way, also when
      // the next run starts with one, and the cursor moves past them.
      const html = drawRuns("continued-flow-trailing-html-breaks", (recipe) => {
        recipe
          .text("alpha<br><br>", 20, 20, { ...flowOptions, html: true })
          .text("bravo<br>", {})
          .text("<br>charlie", {})
          .text("delta\n", {})
          .text("echo", {})
          .text("", { flow: false })
          .text("<br>", 20, 200, { ...flowOptions, html: true, flow: false })
          .text("one<br><br>", 20, 250, { font: "arial", html: true })
          .text("two", { font: "arial", flow: false });
      });
      expect(html.map((run) => run.text)).to.deep.equal([
        "alpha",
        "bravo",
        "charlie",
        "delta",
        "echo",
        "one",
        "two",
      ]);
      const steps = html.slice(1, 5).map((run, index) => html[index].y - run.y);
      expect(steps.map((step) => Math.round(step / lineHeight))).to.deep.equal([
        2, 2, 0, 1,
      ]);
      expect(html[5].y - html[6].y).to.be.closeTo(2 * lineHeight, 0.01);
    });

    it("aligns a flow ended with empty text as one ended with text", () => {
      const draw = (recipe, ending) => {
        recipe
          .text("delta ", 20, 20, {
            ...flowOptions,
            textBox: { width: 300, textAlign: "right" },
          })
          .text("lima ", {});
        ending(recipe);
      };
      const empty = drawRuns("continued-flow-right-empty-end", (recipe) =>
        draw(recipe, (r) => r.text("", { flow: false })),
      );
      const page = drawRuns("continued-flow-right-page-end", (recipe) =>
        draw(recipe, () => {}),
      );
      const text = drawRuns("continued-flow-right-text-end", (recipe) => {
        recipe
          .text("delta ", 20, 20, {
            ...flowOptions,
            textBox: { width: 300, textAlign: "right" },
          })
          .text("lima ", { flow: false });
      });
      // Runs of only spaces at the end of the flow add no space to the line,
      // nor does an HTML element's trailing space.
      const spaces = drawRuns("continued-flow-right-spaces-end", (recipe) =>
        draw(recipe, (r) => r.text("  ", {}).text(" ", { flow: false })),
      );
      const html = drawRuns("continued-flow-right-html-end", (recipe) => {
        recipe
          .text("delta ", 20, 20, {
            ...flowOptions,
            textBox: { width: 300, textAlign: "right" },
          })
          .text("<u>lima</u> ", { html: true, flow: false });
      });
      expect(empty.map((run) => run.x)).to.deep.equal(text.map((run) => run.x));
      expect(page.map((run) => run.x)).to.deep.equal(text.map((run) => run.x));
      expect(spaces.map((run) => run.x)).to.deep.equal(
        text.map((run) => run.x),
      );
      expect(html.map((run) => run.x)).to.deep.equal(text.map((run) => run.x));
    });

    it("wraps where one run ends and the next begins", () => {
      const runs = drawRuns("continued-flow-run-boundary-wrap", (recipe) => {
        recipe
          .text("aaa bbb", 20, 20, {
            ...flowOptions,
            size: 30,
            textBox: { width: 150 },
          })
          .text("ccc", {})
          .text("", { flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal(["aaa bbb", "ccc"]);
      expect(runs[1].y).to.be.below(runs[0].y);
      expect(runs[1].x).to.equal(20);

      // An HTML run whose first word does not fit starts the next line, and
      // its later elements follow it there.
      const html = drawRuns(
        "continued-flow-run-boundary-wrap-html",
        (recipe) => {
          recipe
            .text("alpha bravo charlie ", 20, 20, {
              ...flowOptions,
              textBox: { width: 120 },
            })
            .text("delta <b>echo</b>", { html: true, flow: false });
        },
      );
      expect(html.map((run) => run.text)).to.deep.equal([
        "alpha bravo charlie",
        "delta ",
        "echo",
      ]);
      expect(html[1].x).to.equal(20);
      expect(html[1].y).to.be.below(html[0].y);
      expect(html[2].y).to.equal(html[1].y);
    });

    it("starts a new line for a run that opens with a block element", () => {
      const runs = drawRuns("continued-flow-html-block", (recipe) => {
        recipe
          .text("hotel", 20, 20, { ...flowOptions, html: true })
          .text("<p>romeo</p>", {})
          .text("", { flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal(["hotel", "romeo"]);
      expect(runs[1].y).to.be.below(runs[0].y);

      const div = drawRuns("continued-flow-html-div", (recipe) => {
        recipe
          .text("lima", 20, 20, flowOptions)
          .text("<div>echo</div>", { html: true, flow: false });
      });
      expect(div.map((run) => run.text)).to.deep.equal(["lima", "echo"]);
      expect(div[1].x).to.equal(20);
      expect(div[1].y).to.be.below(div[0].y);
    });

    it("starts a new line for an HTML run after a closed block element", () => {
      const runs = drawRuns("continued-flow-html-block-end", (recipe) => {
        recipe
          .text("<p>alpha</p>", 20, 20, { ...flowOptions, html: true })
          .text("<b>bravo</b>", {})
          .movedown()
          .text("<div>one</div>", {})
          .text("<i>two</i>", { flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal([
        "alpha",
        "bravo",
        "one",
        "two",
      ]);
      const lineHeight = runs[0].y - runs[1].y;
      expect(lineHeight).to.be.above(5);
      expect(runs[1].x).to.equal(runs[0].x);
      // movedown() after a closed block adds no blank line.
      expect(runs[1].y - runs[2].y).to.be.closeTo(lineHeight, 0.01);
      expect(runs[2].y - runs[3].y).to.be.closeTo(lineHeight, 0.01);

      // A run without text in between does not change that.
      const between = drawRuns(
        "continued-flow-html-block-end-empty",
        (recipe) => {
          recipe
            .text("<p>alpha</p>", 20, 20, { ...flowOptions, html: true })
            .text("", {})
            .text("bravo", { flow: false });
        },
      );
      expect(between.map((run) => run.text)).to.deep.equal(["alpha", "bravo"]);
      expect(between[1].x).to.equal(20);
      expect(between[1].y).to.be.below(between[0].y);
    });

    it("collapses an HTML run's first space into the space before it", () => {
      let alphaAdvance;
      const runs = drawRuns("continued-flow-html-space", (recipe) => {
        alphaAdvance = runAdvance(recipe, "alpha ", flowOptions);
        recipe
          .text("alpha ", 20, 20, flowOptions)
          .text(" oscar", { html: true })
          .text("", { flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal(["alpha ", "oscar"]);
      expect(runs[1].x - runs[0].x).to.be.closeTo(alphaAdvance, 0.01);

      // After a word, the space stays, as a run of its own before an element.
      const kept = drawRuns("continued-flow-html-space-kept", (recipe) => {
        recipe
          .text("hotel", 20, 20, flowOptions)
          .text(" india", { html: true })
          .text(" <u>oscar</u>", {})
          .text("", { flow: false });
      });
      expect(kept.map((run) => run.text)).to.deep.equal([
        "hotel",
        " india",
        " ",
        "oscar",
      ]);
    });

    it("adds up line ends and ignores movedown(0) after one", () => {
      const draw = (name, moves) =>
        drawRuns(name, (recipe) => {
          recipe.text("a", 20, 20, flowOptions);
          moves(recipe);
          recipe.text("b", {}).text("", { flow: false });
        });
      const twice = draw("continued-flow-movedown-twice", (r) =>
        r.movedown().movedown(),
      );
      const two = draw("continued-flow-movedown-two", (r) => r.movedown(2));
      const broken = draw("continued-flow-break-movedown", (r) =>
        r.text("\n", {}).movedown(),
      );
      const zero = draw("continued-flow-movedown-zero-after", (r) =>
        r.movedown().movedown(0),
      );
      const one = draw("continued-flow-movedown-one", (r) => r.movedown());
      expect(twice[1].y).to.equal(two[1].y);
      expect(broken[1].y).to.equal(two[1].y);
      expect(zero[1].y).to.equal(one[1].y);
    });

    it("gives a blank line the height of the line after it", () => {
      const gap = (name, first) => {
        const runs = drawRuns(name, (recipe) => {
          recipe
            .text(first, 20, 20, { ...flowOptions, size: 8 })
            .text("BIG", { size: 30 })
            .text("", { flow: false });
        });
        return runs[0].y - runs[1].y;
      };
      const withBlank = gap("continued-flow-blank-height", "small\n\n");
      const withoutBlank = gap("continued-flow-no-blank", "small\n");
      // The blank line is as tall as the 30-point line, not the 8-point one.
      expect(withBlank - withoutBlank).to.be.above(20);
    });

    it("lays out each flowed run after the flow's open line only", () => {
      const kept = [];
      const runs = drawRuns("continued-flow-open-line", (recipe) => {
        const options = { font: "arial", size: 12 };
        recipe.text("start ", 20, 20, {
          ...options,
          flow: true,
          textBox: { width: 200, textAlign: "justify" },
        });
        for (let index = 0; index < 200; ++index) {
          recipe.text(index % 3 ? "word " : "longer ", options);
          kept.push(recipe._previousTextObjects.length);
        }
        recipe.text("", { flow: false });
      });
      // Copying and searching every earlier run for each run took time
      // with the square of the runs; a line holds a few dozen of them.
      expect(Math.max(...kept)).to.be.below(40);
      expect(runs).to.have.length(201);
      expect(runs.map((run) => run.text).join("")).to.match(/^start /);
      const lines = new Set(runs.map((run) => run.y));
      expect(lines.size).to.be.above(10);
    });

    it("flows calls without coordinates unless they pass flow: false", () => {
      const runs = drawRuns("continued-flow-implicit", (recipe) => {
        recipe
          .text("Hello ", { font: "arial" })
          .text("world", {})
          .text("", { flow: false })
          .movedown()
          .text("one", { font: "arial", flow: false })
          .movedown()
          .text("two", { font: "arial", flow: false });
      });
      expect(runs.map((run) => run.text)).to.deep.equal([
        "Hello ",
        "world",
        "one",
        "two",
      ]);
      expect(runs[1].y).to.equal(runs[0].y);
      // movedown() after a text box moves one line, as within a box.
      const lineHeight = runs[0].y - runs[2].y;
      expect(lineHeight).to.be.within(10, 20);
      expect(runs[2].y - runs[3].y).to.be.closeTo(lineHeight, 0.01);
    });
  });
});
