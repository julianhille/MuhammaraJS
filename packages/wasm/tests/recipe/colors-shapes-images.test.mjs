import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm, DeviceColorSpace } from "../../index.js";
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

  it("exposes frozen colorspace constants valued as in native", async function () {
    var Recipe = await getRecipe();
    assert.deepEqual(Recipe.Colorspace, {
      RGB: "rgb",
      CMYK: "cmyk",
      GRAY: "gray",
      SEPARATION: "separation",
    });
    assert.deepEqual(DeviceColorSpace, {
      RGB: "rgb",
      GRAY: "gray",
      CMYK: "cmyk",
    });
    assert.ok(Object.isFrozen(Recipe.Colorspace));
    assert.ok(Object.isFrozen(DeviceColorSpace));
  });

  it("draws the gray and CMYK how-to colors", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 595, 842);
    writer
      .startPageContentContext(page)
      .drawRectangle(72, 700, 100, 50, {
        type: "fill",
        colorspace: DeviceColorSpace.GRAY,
        color: 0x80,
      })
      .drawRectangle(200, 700, 100, 50, {
        type: "fill",
        colorspace: DeviceColorSpace.CMYK,
        color: 0x00ff0000,
      })
      .drawRectangle(328, 700, 100, 50, { type: "fill", color: "teal" });
    writer.writePage(page);
    var lowLevelBytes = writer.end();
    writeOutput("colors-shapes-images-how-to-low-level", lowLevelBytes);
    var lowLevel = new TextDecoder("latin1").decode(lowLevelBytes);
    assert.match(lowLevel, /0\.50\d* g/);
    assert.match(lowLevel, /0 1 0 0 k/);
    assert.match(lowLevel, /0 0\.50\d* 0\.50\d* rg/);
    var recipeBytes = new Recipe({ compress: false })
      .createPage(595, 842)
      .rectangle(72, 72, 100, 50, { fill: "#80" })
      .rectangle(200, 72, 100, 50, { fill: "#00ff0000" })
      .rectangle(328, 72, 100, 50, { fill: [0, 0, 0, 255] })
      .endPage()
      .endPDF();
    writeOutput("colors-shapes-images-how-to-recipe", recipeBytes);
    var recipe = new TextDecoder("latin1").decode(recipeBytes);
    assert.match(recipe, /0\.50\d* g/);
    assert.match(recipe, /0 1 0 0 k/);
    assert.match(recipe, /0 0 0 1 k/);
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
    ["__proto__", "constructor", "toString"].forEach((colorspace) => {
      var inherited = {
        name: "TypeError",
        message: `Unknown colorspace: ${colorspace}`,
      };
      assert.throws(
        () => recipe.chroma("polluted", "#ff0000", colorspace),
        inherited,
      );
      assert.throws(
        () => recipe.rectangle(10, 10, 20, 20, { fill: "#ff0000", colorspace }),
        inherited,
      );
    });
    assert.equal({}.polluted, undefined);
    writeOutput(
      "colors-shapes-images-unknown-colorspace",
      recipe.endPage().endPDF(),
    );
  });

  it("keeps registered colors per Recipe and ignores inherited names", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var recipe = new Recipe({ compress: false }).createPage(200, 200);
    var other = new Recipe();
    recipe.chroma("__proto__", "#123456").chroma("brand", "#654321");
    // Colors registered on one Recipe stay in that Recipe.
    assert.equal(other.knownColors.rgb.brand, undefined);
    assert.equal(Object.hasOwn(other.knownColors.rgb, "__proto__"), false);
    // An inherited key is no color name; "__proto__" is a registered one.
    var bytes = recipe
      .rectangle(10, 10, 20, 20, { fill: "constructor" })
      .rectangle(40, 10, 20, 20, { fill: "__proto__" })
      .endPage()
      .endPDF();
    writeOutput("colors-shapes-images-per-recipe-colors", bytes);
    var reader = muhammara.createReader(bytes);
    var content = [];
    for (var id = 1; id < reader.getXrefSize(); id++) {
      var object = reader.parseNewObject(id);
      if (!object || object.getType() !== muhammara.ePDFObjectStream) continue;
      var input = reader.startReadingFromStream(object.toPDFStream());
      var chunks = [];
      while (input.notEnded()) chunks.push(...input.read(4096));
      content.push(new TextDecoder("latin1").decode(new Uint8Array(chunks)));
    }
    reader.end();
    assert.match(content.join("\n"), /0\.070588 0\.203922 0\.337255 rg/);
    writeOutput("colors-shapes-images-per-recipe-colors-other", other.endPDF());
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
    writeOutput("colors-shapes-images-polygon-derived-source", source);
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
    writeOutput(
      "colors-shapes-images-chroma-loader",
      recipe.endPage().endPDF(),
    );
  });

  it("names Separation inks freely and keeps the first color of a shared ink", async function () {
    var Recipe = await getRecipe();
    var separationBytes = new Recipe({ compress: false })
      .createPage(200, 200)
      .chroma("__proto__", "#ff0000", "separation")
      .chroma("constructor", "#0000ff", "separation")
      .rectangle(10, 10, 20, 20, {
        fill: "__proto__",
        colorspace: "separation",
      })
      .rectangle(40, 10, 20, 20, {
        fill: "constructor",
        colorspace: "separation",
      })
      // A stroke resolves before the fill, so its color is the ink
      // alternate, as in native.
      .rectangle(70, 10, 40, 40, {
        fill: "#ff0000",
        stroke: "#00ff00",
        colorName: "ink",
        colorspace: "separation",
      })
      .endPage()
      .endPDF();
    writeOutput("colors-shapes-images-separation-ink-names", separationBytes);
    var raw = new TextDecoder("latin1").decode(separationBytes);
    assert.equal(raw.match(/\/Separation \/__proto__ \/DeviceRGB/g)?.length, 1);
    assert.equal(
      raw.match(/\/Separation \/constructor \/DeviceRGB/g)?.length,
      1,
    );
    assert.equal(raw.match(/\/Separation \/ink \/DeviceRGB/g)?.length, 1);
    assert.match(raw, /\/C1 \[ 0 1 0 \]/);
  });

  it("strokes a filled shape with its color, not the fill", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var colors = { fill: "#ff0000", color: "#0000ff" };
    var bytes = new Recipe({ compress: false })
      .createPage(300, 300)
      .rectangle(10, 10, 40, 40, colors)
      .circle(100, 30, 20, colors)
      .ellipse(160, 30, 20, 10, colors)
      .arc(220, 30, 20, 0, 90, colors)
      .polygon(
        [
          [10, 100],
          [50, 100],
          [30, 140],
        ],
        colors,
      )
      .endPage()
      .endPDF();
    writeOutput("colors-shapes-images-stroke-with-color", bytes);
    var reader = muhammara.createReader(bytes);
    var content = [];
    for (var id = 1; id < reader.getXrefSize(); id++) {
      var object = reader.parseNewObject(id);
      if (!object || object.getType() !== muhammara.ePDFObjectStream) continue;
      var input = reader.startReadingFromStream(object.toPDFStream());
      var chunks = [];
      while (input.notEnded()) chunks.push(...input.read(4096));
      content.push(new TextDecoder("latin1").decode(new Uint8Array(chunks)));
    }
    reader.end();
    var all = content.join("\n");
    // Every shape fills red and strokes its border blue; native's rectangle
    // sets each color twice.
    assert.ok(all.match(/\b1 0 0 rg\b/g)?.length >= 5);
    assert.ok(all.match(/\b0 0 1 RG\b/g)?.length >= 5);
    assert.doesNotMatch(all, /\b1 0 0 RG\b/);
  });

  ["new", "source", "edited"].forEach(function (mode) {
    it(`draws separation colors on ${mode} pages`, async function () {
      var Recipe = await getRecipe();
      var muhammara = await createMuhammaraWasm();
      var source = new Recipe().createPage(200, 200).endPage().endPDF();
      writeOutput(`colors-shapes-images-separation-${mode}-source`, source);
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
        .text("<u>Under</u>", 80, 80, {
          html: true,
          color: "SpotOrange",
          colorspace: "separation",
        })
        .circle(120, 40, 20, {
          fill: [0, 255, 0, 0],
          colorspace: "separation",
          colorName: "SpotGreen",
        })
        .text("<u>Value</u>", 80, 110, {
          html: true,
          color: [0, 255, 0, 0],
          colorspace: "separation",
          colorName: "SpotGreen",
        })
        .rectangle(10, 120, 40, 40, {
          fill: "#0000ff",
          colorspace: "separation",
        })
        // Neither a fill nor a stroke: the default color strokes as the
        // colorName ink.
        .line(10, 180, 60, 180, {
          colorspace: "separation",
          colorName: "SpotDefault",
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
      // colorName names only the painted color; no second definition of the
      // ink with the default alternate.
      assert.equal(raw.match(/\/Separation \/SpotGreen\b/g)?.length, 1);
      assert.equal(
        raw.match(/\/Separation \/SpotDefault \/DeviceRGB/g)?.length,
        1,
      );

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
      var decoded = streams.map((stream) => {
        var input = reader.startReadingFromStream(stream.toPDFStream());
        var chunks = [];
        while (input.notEnded()) chunks.push(...input.read(4096));
        return new TextDecoder("latin1").decode(new Uint8Array(chunks));
      });
      var content = decoded.join("\n");
      reader.end();
      // Writing a color space mid-path would split the path across content
      // streams, which edited pages place as separate forms.
      decoded.forEach((stream) =>
        assert.equal(
          stream.match(/\bq\b/g)?.length,
          stream.match(/\bQ\b/g)?.length,
        ),
      );
      // Fills, the texts and the colorName circle select a Separation color
      // at full tint; both lines and both underlines stroke one, including
      // the underline of a spot color given by value with colorName.
      assert.equal(content.match(/\/\S+ cs\s+1 scn/g)?.length, 5);
      assert.equal(content.match(/\/\S+ CS\s+1 SCN/g)?.length, 4);
      // A value without an ink name keeps its device color.
      assert.match(content, /0 0 1 rg/);
    });
  });
});
