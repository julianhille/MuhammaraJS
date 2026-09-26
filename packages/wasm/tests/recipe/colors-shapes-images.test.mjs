import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

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
    writeOutput("colors-shapes-normalized-colors", bytes);
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

  it("rejects unknown colorspaces", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe().createPage(300, 300);
    var unknown = { name: "TypeError", message: "Unknown colorspace: lab" };
    assert.throws(() => recipe.chroma("brand", "#ff0000", "lab"), unknown);
    assert.throws(
      () => recipe.text("Lab", 10, 10, { color: "#ff0000", colorspace: "lab" }),
      unknown,
    );
    assert.throws(
      () =>
        recipe.rectangle(10, 10, 20, 20, { fill: "brand", colorspace: "lab" }),
      unknown,
    );
    recipe.endPage().endPDF();
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
    var bytes = recipe.endPDF();
    writeOutput("colors-shapes-images-placement", bytes);
    var reader = (await createMuhammaraWasm()).createReader(bytes);
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
    var bytes = recipe.endPDF();
    writeOutput("colors-shapes-rectangle-radii-ngon-debug", bytes);
    var reader = (await createMuhammaraWasm()).createReader(bytes);
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
    var bytes = recipe.endPDF();
    writeOutput("colors-shapes-polygon-derived-edit", bytes);
    var reader = (await createMuhammaraWasm()).createReader(bytes);
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
    var bytes = recipe.endPDF();
    writeOutput("colors-shapes-arrows-triangles-tiff", bytes);
    var reader = (await createMuhammaraWasm()).createReader(bytes);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
  });

  it("rejects the unsupported chroma loader", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe().createPage();
    assert.throws(() => recipe.chroma("!load", "colors.json"), /!load/);
    recipe.endPage().endPDF();
  });

  ["new", "source", "edited"].forEach(function (mode) {
    it(`draws separation colors on ${mode} pages`, async function () {
      var Recipe = await getRecipe();
      var muhammara = await createMuhammaraWasm();
      var source = new Recipe().createPage(200, 200).endPage().endPDF();
      var recipe =
        mode === "new"
          ? new Recipe({ compress: false }).createPage(200, 200)
          : mode === "source"
            ? new Recipe(source).createPage(200, 200)
            : new Recipe(source).editPage(1);
      recipe
        .chroma("SpotOrange", [255, 128, 0], "separation")
        .rectangle(10, 10, 40, 40, {
          fill: "SpotOrange",
          colorspace: "separation",
        })
        .line(10, 60, 60, 60, {
          stroke: "SpotOrange",
          colorspace: "separation",
        })
        .text("Spot", 10, 80, { color: "SpotOrange", colorspace: "separation" })
        .circle(120, 40, 20, {
          fill: [0, 255, 0, 0],
          colorspace: "separation",
          colorName: "SpotGreen",
        })
        .rectangle(10, 120, 40, 40, {
          fill: "#0000ff",
          colorspace: "separation",
        })
        .endPage();
      var bytes = recipe.endPDF();
      writeOutput(`colors-separation-${mode}`, bytes);
      var raw = new TextDecoder("latin1").decode(bytes);
      assert.equal(
        raw.match(/\/Separation \/SpotOrange \/DeviceRGB/g)?.length,
        1,
      );
      assert.equal(
        raw.match(/\/Separation \/SpotGreen \/DeviceCMYK/g)?.length,
        1,
      );
      assert.equal(recipe.knownColors.separation.SpotGreen, "00ff0000");

      var reader = muhammara.createReader(bytes);
      var page = reader.parsePage(mode === "source" ? 1 : 0).getDictionary();
      var contents = reader.queryDictionaryObject(page, "Contents");
      var streams =
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
      // Edited pages draw into form XObjects placed on the page.
      var resources = reader.queryDictionaryObject(page, "Resources");
      var xObjects = reader.queryDictionaryObject(resources, "XObject");
      Object.values(xObjects ? xObjects.toJSObject() : {}).forEach(
        (reference) =>
          streams.push(
            reader.parseNewObject(
              reference.toPDFIndirectObjectReference().getObjectID(),
            ),
          ),
      );
      var content = streams
        .map((stream) => {
          var input = reader.startReadingFromStream(stream.toPDFStream());
          var chunks = [];
          while (input.notEnded()) chunks.push(...input.read(4096));
          return new TextDecoder("latin1").decode(new Uint8Array(chunks));
        })
        .join("\n");
      reader.end();
      // Fills, the text and the colorName circle select a Separation color at
      // full tint; the line strokes one.
      assert.equal(content.match(/\/\S+ cs\s+1 scn/g)?.length, 3);
      assert.equal(content.match(/\/\S+ CS\s+1 SCN/g)?.length, 1);
      // A value without an ink name keeps its device color.
      assert.match(content, /0 0 1 rg/);
    });
  });
});
