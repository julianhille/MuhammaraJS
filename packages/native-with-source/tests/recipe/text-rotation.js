const path = require("path");
const zlib = require("zlib");
const assert = require("chai").assert;
const Recipe = require("@muhammara/native-with-source").Recipe;

/**
 * The `cm` matrices of every stream in a PDF, compressed or not, in order.
 * @param {Buffer} pdf - The PDF bytes.
 * @returns {number[][]} One [a, b, c, d, e, f] array per `cm` operator.
 */
function cmOperators(pdf) {
  const matrices = [];
  let start = pdf.indexOf("stream\r\n");
  while (start !== -1) {
    start += "stream\r\n".length;
    const end = pdf.indexOf("endstream", start);
    let data = pdf.subarray(start, end);
    try {
      data = zlib.inflateSync(data);
    } catch {
      // An uncompressed stream is read as it is.
    }
    for (const match of data
      .toString("latin1")
      .matchAll(/((?:-?[\d.]+\s+){6})cm\b/g)) {
      matrices.push(match[1].trim().split(/\s+/).map(Number));
    }
    start = pdf.indexOf("stream\r\n", end + "endstream".length);
  }
  return matrices;
}

/**
 * Draw one text run on a new 400 x 400 page and return the `cm` that places
 * its Form XObject.
 * @param {Object} options - The text options.
 * @returns {number[]} The placing [a, b, c, d, e, f] matrix.
 */
function textPlacement(options) {
  let matrices;
  new Recipe(Buffer.from("new"), null, { compress: false })
    .createPage(400, 400)
    // Opacity draws through a Form XObject even without rotation.
    .text("alpha", 100, 100, { opacity: 0.5, ...options })
    .endPage()
    .endPDF((bytes) => {
      matrices = cmOperators(Buffer.from(bytes));
    });
  return matrices[matrices.length - 1];
}

describe("Text Rotation", () => {
  it("Add text with rotation", (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test.pdf");
    const output = path.join(__dirname, "../output/Add text - rotation1.pdf");
    const recipe = new Recipe(src, output);

    const pages = recipe.metadata.pages;
    const angles = [
      0, 0, 1, 45, -45, 90, 135, -135, 180, 270, 360, -90, -180, -270, -360,
      450,
    ];
    for (let i = 1; i <= pages; i++) {
      const angle = angles[i] || 0;
      recipe
        .editPage(i)
        .circle("center", 300, 10, {
          stroke: "#0032FF",
        })
        .text(`${angle} ROTATION pjqy`, "center", 300, {
          bold: true,
          size: 80,
          color: "#0000FF",
          align: "center center",
          rotation: angle,
          opacity: 0.25,
        })
        .circle("center", "center", 10, {
          stroke: "#0032FF",
        })
        .text(`${angle} ROTATION pjqy`, "center", "center", {
          bold: true,
          size: 80,
          color: "#0000FF",
          align: "center center",
          rotation: angle,
          opacity: 0.5,
        })
        .circle("center", 500, 10, {
          stroke: "#0032FF",
        })
        .text(`${angle} ROTATION pjqy`, "center", 500, {
          bold: true,
          size: 80,
          color: "#0000FF",
          align: "center center",
          rotation: angle,
        })
        .endPage();
    }
    recipe.endPDF(done);
  });

  it("turns text clockwise around its position", () => {
    const [, , , , x, y] = textPlacement({});
    const [a, b, c, d, e, f] = textPlacement({ rotation: 30 });
    // A positive rotation turns clockwise: [cos -sin sin cos]. Wasm Recipe
    // asserts the same direction and pivot in text-rotation.test.mjs.
    assert.deepEqual([a, b, c, d], [0.866025, -0.5, 0.5, 0.866025]);
    // The pivot p satisfies p + R(placement - p) = (e, f).
    const tx = e - (a * x + c * y);
    const ty = f - (b * x + d * y);
    const det = (1 - a) * (1 - d) - c * b;
    const pivotX = (tx * (1 - d) + c * ty) / det;
    const pivotY = ((1 - a) * ty + b * tx) / det;
    // Recipe (100, 100) is PDF (100, 300) on a 400 point high page.
    assert.closeTo(pivotX, 100, 0.01);
    assert.closeTo(pivotY, 300, 0.01);
  });
});
