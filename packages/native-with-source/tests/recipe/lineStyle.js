const assert = require("assert");
const { inflateSync } = require("zlib");
const Recipe = require("@muhammara/native-with-source").Recipe;

function getContentStream(pdf) {
  const marker = Buffer.from("stream\r\n");
  const endMarker = Buffer.from("\r\nendstream");
  const streams = [];
  let offset = 0;
  let start;

  while ((start = pdf.indexOf(marker, offset)) !== -1) {
    start += marker.length;
    const end = pdf.indexOf(endMarker, start);
    streams.push(inflateSync(pdf.subarray(start, end)).toString());
    offset = end + endMarker.length;
  }
  return streams.join("\n");
}

describe("Recipe lineStyle", () => {
  it("writes line style operators", () => {
    const recipe = new Recipe(Buffer.from("new"));
    recipe
      .createPage(100, 100)
      .lineStyle({
        width: 3,
        cap: 1,
        join: 2,
        miterLimit: 4,
        dash: [6, 3],
        dashPhase: 2,
      })
      .line([
        [10, 10],
        [90, 90],
      ])
      .endPage()
      .endPDF();

    const content = getContentStream(recipe.outStream.toBuffer());
    assert.match(
      content,
      /q\s+1 J\s+2 j\s+\[ 6 3 \] 2 d\s+4 M[\s\S]*?3 w[\s\S]*?S\s+Q/,
    );
  });

  it("applies lineWidth to subsequent lines", () => {
    const recipe = new Recipe(Buffer.from("new"));
    recipe
      .createPage(100, 100)
      .lineWidth(5)
      .line([
        [10, 10],
        [90, 90],
      ])
      .endPage()
      .endPDF();

    const content = getContentStream(recipe.outStream.toBuffer());
    assert.match(content, /q[\s\S]*?5 w[\s\S]*?S\s+Q/);
  });
});
