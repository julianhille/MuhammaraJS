import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { inflateSync } from "node:zlib";
import { getRecipe } from "./recipe.mjs";

function getContentStream(pdf) {
  var bytes = Buffer.from(pdf);
  var marker = Buffer.from("stream\r\n");
  var endMarker = Buffer.from("\r\nendstream");
  var streams = [];
  var offset = 0;
  var start;

  while ((start = bytes.indexOf(marker, offset)) !== -1) {
    start += marker.length;
    var end = bytes.indexOf(endMarker, start);
    streams.push(inflateSync(bytes.subarray(start, end)).toString());
    offset = end + endMarker.length;
  }
  return streams.join("\n");
}

describe("Recipe lineStyle", function () {
  it("writes line style operators", async function () {
    var Recipe = await getRecipe();
    var pdf = new Recipe()
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
    var content = getContentStream(pdf);

    assert.match(
      content,
      /q\s+3 w\s+1 J\s+2 j\s+4 M\s+\[ 6 3 \] 2 d[\s\S]*?S\s+Q/,
    );
  });

  it("applies lineWidth to subsequent lines", async function () {
    var Recipe = await getRecipe();
    var pdf = new Recipe()
      .createPage(100, 100)
      .lineWidth(5)
      .line([
        [10, 10],
        [90, 90],
      ])
      .endPage()
      .endPDF();
    var content = getContentStream(pdf);

    assert.match(content, /q\s+5 w[\s\S]*?S\s+Q/);
  });
});
