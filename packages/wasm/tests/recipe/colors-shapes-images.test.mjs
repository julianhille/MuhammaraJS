import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";

describe("Recipe colors, shapes, and images", function () {
  it("writes normalized device colors and shared path state", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe({ compress: false }).createPage(300, 300);
    recipe
      .chroma("brand", "%10,20,30")
      .rectangle(10, 10, 40, 30, { fill: "brand", opacity: 0.5 })
      .circle(80, 30, 15, {
        stroke: [0, 255, 0],
        colorspace: "rgb",
        lineCap: "round",
        lineJoin: "bevel",
        dash: [2, 1],
      })
      .ellipse(130, 30, 20, 10, { fill: "#7f" })
      .arc(190, 30, 15, 0, 180, { stroke: "%0,100,0,0", colorspace: "cmyk" })
      .n_gon(40, 100, 20, 5, { fill: "#ff0000", rotation: 20, skewX: 5 })
      .star(100, 100, 20, 6, { stroke: "#00ff00" })
      .arrow(170, 100, {
        type: "dart",
        head: [20, 30],
        shaft: [40, 10],
        fill: "#0000ff",
      })
      .triangle(230, 110, [30, 40, 50], { fill: "#123456" })
      .endPage();
    var bytes = recipe.endPDF();
    var reader = (await createMuhammaraWasm()).createReader(bytes);
    assert.equal(reader.getPagesCount(), 1);
    assert.deepEqual(reader.getPageInfo(0).mediaBox, [0, 0, 300, 300]);
    var contents = reader
      .parsePage(0)
      .getDictionary()
      .toPDFDictionary()
      .queryObject("Contents");
    var contentObject = contents.toPDFIndirectObjectReference()
      ? reader.parseNewObject(
          contents.toPDFIndirectObjectReference().getObjectID(),
        )
      : contents;
    assert.ok(contentObject.toPDFStream() || contentObject.toPDFArray());
    reader.end();
  });

  it("places registered byte images with fit, alignment, transforms, and reuse", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe({ compress: false }).createPage(300, 300);
    recipe
      .image("logo", 80, 80, {
        width: 80,
        height: 40,
        align: "center center",
        opacity: 0.5,
        rotation: 15,
        skewY: 5,
      })
      .image("logo", 180, 80, { scale: 0.25 })
      .endPage();
    var reader = (await createMuhammaraWasm()).createReader(recipe.endPDF());
    var page = reader.parsePage(0).getDictionary().toPDFDictionary();
    assert.ok(
      page.queryObject("Resources").toPDFDictionary().queryObject("XObject"),
    );
    reader.end();
  });

  it("supports native rectangle coordinates, four radii, and n-gon vertex/debug options", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe({ compress: false }).createPage(200, 200);
    recipe
      .rectangle(10, 20, 80, 40, {
        useGivenCoords: true,
        borderRadius: [1, 2, 3, 4],
        fill: "#ff0000",
      })
      .n_gon(120, 80, 30, 5, {
        stroke: "#000000",
        rotation: 15,
        rotationVertice: 3,
        debug: true,
      })
      .endPage();
    var reader = (await createMuhammaraWasm()).createReader(recipe.endPDF());
    assert.deepEqual(reader.getPageInfo(0).mediaBox, [0, 0, 200, 200]);
    var contents = reader
      .parsePage(0)
      .getDictionary()
      .toPDFDictionary()
      .queryObject("Contents");
    var stream = reader.parseNewObject(
      contents.toPDFIndirectObjectReference().getObjectID(),
    );
    var source = new TextDecoder().decode(
      new Uint8Array(
        reader.startReadingFromStream(stream.toPDFStream()).read(4096),
      ),
    );
    assert.match(source, /14 20 m/);
    assert.ok((source.match(/ c\r?\n/g) || []).length >= 12);
    reader.end();
  });

  it("edits byte source pages with polygon-derived shapes", async function () {
    var Recipe = await getRecipe();
    var source = new Recipe({ compress: false })
      .createPage(200, 200)
      .rectangle(1, 1, 1, 1, { fill: "#000000" })
      .endPage()
      .endPDF();
    var recipe = new Recipe(source, { compress: false })
      .editPage(1)
      .polygon(
        [
          [10, 10],
          [30, 10],
          [20, 30],
        ],
        { fill: "#ff0000" },
      )
      .n_gon(60, 30, 15, 5, { fill: "#00ff00" })
      .star(110, 30, 15, { fill: "#0000ff" })
      .arrow(155, 30, { fill: "#123456" })
      .triangle(20, 80, [20, 25, 30], { fill: "#654321" })
      .endPage();
    var reader = (await createMuhammaraWasm()).createReader(recipe.endPDF());
    var contents = reader
      .parsePage(0)
      .getDictionary()
      .toPDFDictionary()
      .queryObject("Contents");
    assert.ok(
      contents.toPDFArray()?.getLength() >= 2,
      "source content and polygon-derived edit context are retained",
    );
    reader.end();
  });

  it("supports every arrow and triangle trait variant and TIFF directory selection", async function () {
    var Recipe = await getRecipe();
    Recipe.registerImage(
      "multipage-tiff",
      new Uint8Array(
        await readFile("tests/TestMaterials/images/tiff/multipage.tif"),
      ),
      "tiff",
    );
    var recipe = new Recipe({ compress: false }).createPage(400, 300);
    ["triangle", "dart", "kite", 1, 2].forEach((type, index) =>
      recipe.arrow(40 + index * 65, 45, {
        type,
        double: index === 0,
        fill: "#0000ff",
      }),
    );
    recipe
      .triangle(30, 130, [30, 40, 50], { traitID: "sss" })
      .triangle(100, 130, [30, 60, 40], { traitID: "sas" })
      .triangle(180, 130, [50, 40, 60], { traitID: "asa" })
      .triangle(
        260,
        130,
        [
          [260, 130],
          [290, 170],
          [320, 130],
        ],
        { traitID: "vtx" },
      )
      .image("multipage-tiff", 20, 200, { width: 80, index: 1 })
      .endPage();
    var reader = (await createMuhammaraWasm()).createReader(recipe.endPDF());
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
  });

  it("rejects unsupported chroma loaders and Separation colors", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe().createPage();
    assert.throws(() => recipe.chroma("!load", "colors.json"), /!load/);
    assert.throws(
      () => recipe.chroma("spot", "#000000", "separation"),
      /separation colors are unsupported/i,
    );
    recipe.endPage().endPDF();
  });
});
