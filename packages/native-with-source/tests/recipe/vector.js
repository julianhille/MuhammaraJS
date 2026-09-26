const path = require("path");
const assert = require("chai").assert;
const zlib = require("zlib");
const muhammara = require("@muhammara/native-with-source");
const Recipe = muhammara.Recipe;

function getFirstContentStream(pdf) {
  const start = pdf.indexOf("stream\r\n") + "stream\r\n".length;
  const end = pdf.indexOf("\r\nendstream", start);
  return zlib.inflateSync(pdf.subarray(start, end)).toString();
}

/** Collects decoded painting blocks from a page and its Form XObjects. */
function getPaintBlocks(reader, pageIndex) {
  const page = reader.parsePage(pageIndex).getDictionary();
  const contents = reader.queryDictionaryObject(page, "Contents");
  const streams =
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
  const resources = reader.queryDictionaryObject(page, "Resources");
  if (resources.exists("XObject")) {
    const forms = reader.queryDictionaryObject(resources, "XObject");
    Object.keys(forms.toJSObject()).forEach((name) => {
      streams.push(reader.queryDictionaryObject(forms, name));
    });
  }
  return streams.flatMap((stream) => {
    const input = reader.startReadingFromStream(stream.toPDFStream());
    const chunks = [];
    while (input.notEnded()) chunks.push(Buffer.from(input.read(4096)));
    const content = Buffer.concat(chunks).toString("latin1");
    return (content.match(/q\r?\n[\s\S]*?\r?\nQ/g) || [content]).filter(
      (block) => /(?:^|\r?\n)(?:f|S)\r?\n/.test(block),
    );
  });
}

describe("Vector", () => {
  it("Add vectors", (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test.pdf");
    const output = path.join(__dirname, "../output/Add vectors.pdf");
    const recipe = new Recipe(src, output);
    const { width, height } = recipe.pageInfo(1);
    recipe
      .editPage(1)
      .rectangle(0, 0, width, height, {
        color: [255, 0, 0],
        opacity: 0.1,
      })
      .rectangle(500, 50, 50, 50, {
        fill: [255, 0, 0],
        skewY: -20,
      })
      .rectangle(500, 50, 50, 50, {
        color: [255, 0, 255],
        opacity: 0.2,
      })
      .rectangle(500, 150, 50, 50, {
        color: [255, 0, 255],
        opacity: 0.4,
      })
      .rectangle(500, 250, 50, 50, {
        fill: [255, 0, 255],
        opacity: 0.6,
        skewX: 10,
      })
      .rectangle(500, 250, 50, 50, {
        color: [255, 0, 255],
        opacity: 0.6,
      })
      .rectangle(500, 350, 50, 50, {
        color: "#3252d3",
        stroke: "#084323",
        lineWidth: 10,
        dash: [5, 5],
      })
      .rectangle(500, 450, 50, 50, {
        color: [255, 0, 255],
        opacity: 0.6,
      })
      .rectangle(475, 475, 50, 50, {
        opacity: 0.3,
        fill: [255, 0, 0],
        stroke: [255, 0, 255],
      })
      .rectangle(475, 475, 50, 50, {
        opacity: 0.3,
        lineWidth: 5,
        fill: [255, 255, 255],
        stroke: [255, 0, 255],
      })
      .rectangle(525, 475, 50, 50, {
        opacity: 0.8,
        lineWidth: 3,
        stroke: [255, 0, 255],
        dash: [5, 5],
      })
      .circle("center", 150, 60, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .circle("center", 150, 30, {
        stroke: "#0032FF",
        dash: [5, 5],
      })
      .circle(400, 250, 20, { color: "#00ff00" })
      .circle(400, 250, 20, { skewX: 30 })
      .circle(400, 250, 20, { skewY: -20 })
      .ellipse(100, 650, 30, 10)
      .ellipse(100, 650, 30, 10, {
        skewY: 30,
        fill: "#00ff00",
        opacity: 0.2,
        stroke: "#ff0000",
        width: 1,
      })
      .rectangle(10, 320, 80, 100, { borderRadius: 5 })
      .rectangle(15, 325, 70, 90, { borderRadius: [5, 10], stroke: "#00ff00" })
      .rectangle(20, 330, 60, 80, {
        borderRadius: [20, 10, 5],
        fill: "#ff00ff",
      })
      .polygon(
        [
          [0, 0],
          [0, 300],
          [200, 300],
        ],
        {
          fill: "#000000",
          stroke: "#00ff00",
          opacity: 0.2,
        },
      )
      .polygon(
        [
          [100, 300],
          [200, 300],
          [100, 100],
        ],
        {
          fill: "#ff0000",
          stroke: "#ff0000",
          opacity: 0.5,
        },
      )
      .polygon(
        [
          [60, 60],
          [60, 300],
          [200, 300],
        ],
        {
          fill: "#00d2ff",
          stroke: "#033002",
          opacity: 0.35,
          dash: [12, 12],
        },
      )
      .polygon(
        [
          [300, 300],
          [450, 600],
          [150, 600],
        ],
        {
          fill: "#0000ff",
          stroke: "#0000ff",
          opacity: 0,
        },
      )
      .polygon(
        [
          [300, 300],
          [450, 600],
          [150, 600],
        ],
        {
          stroke: "#ff0000",
          skewY: 20,
        },
      )
      .polygon(
        [
          [250, 650],
          [350, 680],
          [300, 700],
          [550, 700],
          [580, 750],
          [250, 750],
        ],
        {
          fill: "#0000ff",
          stroke: "#0000ff",
          opacity: 0.75,
        },
      )
      .line(
        [
          [20, 20],
          [60, 20],
          [60, 40],
          [80, 60],
          [0, 60],
          [20, 40],
        ],
        {
          lineWidth: 10,
          dash: [0, 0],
        },
      );
    let x = 175;
    let y = 11;
    let h = 20;
    recipe
      .text("lineCaps:", 100, 5 + h)
      .line(
        [
          [x, y],
          [x + 20, y],
        ],
        { lineWidth: 10, lineCap: "butt" },
      )
      .text("butt", x + 30, 5, { color: "red" })
      .line(
        [
          [x, y + 20],
          [x + 20, y + 20],
        ],
        { lineWidth: 10, lineCap: "round" },
      ) // default
      .text("round", x + 30, 5 + h, { color: "green" })
      .line(
        [
          [x, y + 40],
          [x + 20, y + 40],
        ],
        { lineWidth: 10, lineCap: "square" },
      )
      .text("square", x + 30, 5 + 2 * h, { color: "red" });

    x = 300;
    y = 10;
    recipe
      .polygon(
        [
          [x, y + 10],
          [x + 20, y + 30],
          [x, y + 50],
        ],
        { lineWidth: 8, lineJoin: "miter", miterLimit: 3 },
      )
      .text("miter", x - 3, 70, { rotation: -45, color: "red" })
      .polygon(
        [
          [x + 40, y + 10],
          [x + 60, y + 30],
          [x + 40, y + 50],
        ],
        { lineWidth: 8, lineJoin: "round" },
      ) // default
      .text("round", x + 37, 70, { rotation: -45, color: "green" })
      .polygon(
        [
          [x + 80, y + 10],
          [x + 100, y + 30],
          [x + 80, y + 50],
        ],
        { lineWidth: 8, lineJoin: "bevel" },
      )
      .text("bevel", x + 77, 70, { rotation: -45, color: "red" })
      .text(":lineJoins", 415, 33)
      .endPage()
      .endPDF(done);
  });

  it("closes pie wedges", (done) => {
    new Recipe(Buffer.from("new"))
      .createPage(200, 200)
      .pie(100, 100, 50, 20, 220, { stroke: "#000000" })
      .endPage()
      .endPDF((pdf) => {
        assert.match(getFirstContentStream(pdf), /\r?\nh\r?\n[\s\S]*?S\r?\n/);
        done();
      });
  });

  it("insets vector strokes within the requested bounds", (done) => {
    const options = {
      fill: "#000000",
      stroke: "#ff0000",
      lineWidth: 10,
    };
    const inheritedOptions = Object.create(options);
    Object.defineProperty(inheritedOptions, "unused", {
      enumerable: true,
      get() {
        throw new Error("Unused option getter must not be evaluated");
      },
    });
    new Recipe(Buffer.from("new"))
      .createPage(100, 60)
      .rectangle(0, 0, 100, 60, inheritedOptions)
      .endPage()
      .createPage(100, 60)
      .rectangle(0, 0, 100, 60, { ...options, borderRadius: 10 })
      .endPage()
      .createPage(80, 80)
      .circle(40, 40, 40, options)
      .endPage()
      .createPage(80, 40)
      .ellipse(40, 20, 40, 20, options)
      .endPage()
      .createPage(80, 80)
      .arc(40, 40, 40, 0, 90, options)
      .endPage()
      .createPage(80, 80)
      .pie(40, 40, 40, 0, 90, options)
      .endPage()
      .createPage(100, 60)
      .rectangle(0, 0, 100, 60, {
        stroke: "#ff0000",
        lineWidth: 10,
      })
      .endPage()
      .endPDF((pdf) => {
        const reader = muhammara.createReader(
          new muhammara.PDFRStreamForBuffer(pdf),
        );
        try {
          const expectedGeometry = [
            [/\b0 0 100 60 re\b/, /\b5 5 90 50 re\b/],
            [/\b0 50 m\b/, /\b5 50 m\b/],
            [/\b0 40 m\b/, /\b5 40 m\b/],
            [/\b0 20 m\b/, /\b5 20 m\b/],
            [/\b80 40 m\b/, /\b75 40 m\b/],
            [/\b40 40 m\s+80 40 l\b/, /\b40 40 m\s+75 40 l\b/],
          ];
          expectedGeometry.forEach((geometry, pageIndex) => {
            const blocks = getPaintBlocks(reader, pageIndex);
            const fillBlock = blocks.find((block) =>
              /(?:^|\r?\n)f\r?\n/.test(block),
            );
            const strokeBlock = blocks.find((block) =>
              /(?:^|\r?\n)S\r?\n/.test(block),
            );
            assert.lengthOf(blocks, 2);
            assert.match(fillBlock, geometry[0]);
            assert.match(strokeBlock, geometry[1]);
            assert.match(strokeBlock, /(?:^|\r?\n)10 w\r?\n/);
            assert.notMatch(blocks.join("\n"), /(?:^|\r?\n)B\r?\n/);
          });
          const strokeOnlyBlocks = getPaintBlocks(reader, 6);
          assert.lengthOf(strokeOnlyBlocks, 1);
          assert.match(strokeOnlyBlocks[0], /\b5 5 90 50 re\b/);
          assert.match(strokeOnlyBlocks[0], /(?:^|\r?\n)10 w\r?\n/);
          assert.match(strokeOnlyBlocks[0], /(?:^|\r?\n)S\r?\n/);
          assert.notMatch(strokeOnlyBlocks[0], /(?:^|\r?\n)(?:f|B)\r?\n/);
        } finally {
          reader.end();
        }
        done();
      });
  });

  it("keeps thick inset strokes concentric and non-inverted", (done) => {
    const options = { fill: "#000000", stroke: "#ff0000", lineWidth: 10 };
    const thick = { fill: "#000000", stroke: "#ff0000", lineWidth: 30 };
    new Recipe(Buffer.from("new"))
      .createPage(80, 40)
      .ellipse(40, 20, 40, 20, options)
      .endPage()
      .createPage(100, 60)
      .rectangle(0, 0, 100, 60, { ...options, borderRadius: 10 })
      .endPage()
      .createPage(20, 20)
      .circle(10, 10, 10, thick)
      .endPage()
      .createPage(20, 20)
      .arc(10, 10, 10, 0, 90, thick)
      .endPage()
      .endPDF((pdf) => {
        const reader = muhammara.createReader(
          new muhammara.PDFRStreamForBuffer(pdf),
        );
        try {
          const strokeBlock = (pageIndex) =>
            getPaintBlocks(reader, pageIndex).find((block) =>
              /(?:^|\r?\n)S\r?\n/.test(block),
            );
          const k = 0.551784;
          const firstCurve = strokeBlock(0)
            .match(/((?:-?[\d.]+\s+){6})c\b/)[1]
            .trim()
            .split(/\s+/)
            .map(Number);
          [5, 20 - 15 * k, 40 - 35 * k, 5, 40, 5].forEach((value, index) => {
            assert.closeTo(firstCurve[index], value, 0.01);
          });
          assert.match(strokeBlock(1), /\b5 50 m\b/);
          assert.match(strokeBlock(1), /\b90 55 l\b/);
          [2, 3].forEach((pageIndex) => {
            // An over-wide stroke collapses the path onto the center point.
            const operands = strokeBlock(pageIndex)
              .match(/(?:-?[\d.]+\s+)+[mc]\b/g)
              .join(" ")
              .match(/-?[\d.]+/g)
              .map(Number);
            assert.isNotEmpty(operands);
            assert.sameMembers([...new Set(operands)], [10]);
          });
        } finally {
          reader.end();
        }
        done();
      });
  });

  it("strokes every line segment, and no empty one, on an edited page", () => {
    const source = path.join(__dirname, "../output/line-edit-source.pdf");
    const output = path.join(__dirname, "../output/line-edit.pdf");
    new Recipe("new", source).createPage(200, 200).endPage().endPDF();
    new Recipe(source, output)
      .editPage(1)
      .line(
        [
          [20, 20],
          [180, 20],
          [180, 100],
        ],
        { stroke: "#ff0000", lineWidth: 6 },
      )
      .endPage()
      .endPDF();
    const reader = muhammara.createReader(output);
    const segments = getPaintBlocks(reader, 0).flatMap((block) =>
      [...block.matchAll(/(\S+) (\S+) m\s+(\S+) (\S+) l/g)].map((match) =>
        match.slice(1).map(Number),
      ),
    );
    assert.deepEqual(segments, [
      [20, 180, 180, 180],
      [180, 180, 180, 100],
    ]);
  });
});
