const path = require("path");
const Recipe = require("@muhammara/native-with-source").Recipe;
const muhammara = require("@muhammara/native-with-source");

describe("Coloring", () => {
  it("Using Names", (done) => {
    const output = path.join(__dirname, "../output/color-special.pdf");
    const recipe = new Recipe("new", output, {
      colorspace: "rgb",
    });
    recipe
      .createPage("letter")
      .chroma("magenta", [0, 255, 0, 0], "separation")
      .text("Separation color magenta", 100, 430, {
        bold: true,
        size: 20,
        color: "magenta",
        colorspace: "separation",
      })
      .line(
        [
          [80, 430],
          [100, 430],
        ],
        { lineWidth: 0.5 },
      )
      .endPage()
      .endPDF(done);
  });

  it("Adding Names", (done) => {
    const output = path.join(__dirname, "../output/color-special.pdf");
    const rgbColors = path.join(
      __dirname,
      "../TestMaterials/recipe/rgb-colors.json",
    );
    const lineOpt = { lineWidth: 0.5 };
    const recipe = new Recipe(output, output, {
      colorspace: "rgb",
    });
    recipe
      .chroma("purple", [255, 0, 255])
      .chroma("yellow", [255, 255, 0])
      .chroma("fucia", "#990066")
      .editPage(1)
      .circle(60, 375, 20, { fill: "yellow", stroke: "fucia" })
      .text("White", 100, 70, {
        bold: true,
        size: 20,
        color: "white",
        colorspace: "gray",
        textBox: { style: { fill: "#00", colorspace: "gray" } },
      })
      .line(
        [
          [80, 70],
          [100, 70],
        ],
        lineOpt,
      )
      .text("Purple", 100, 100, { bold: true, size: 20, color: "purple" })
      .line(
        [
          [80, 100],
          [100, 100],
        ],
        lineOpt,
      )
      .text("Yellow", 100, 130, { bold: true, size: 20, color: "yellow" })
      .line(
        [
          [80, 130],
          [100, 130],
        ],
        lineOpt,
      )
      .text("Fucia", 100, 160, { bold: true, size: 20, color: "fucia" })
      .line(
        [
          [80, 160],
          [100, 160],
        ],
        lineOpt,
      )
      .text("Magenta", 100, 190, {
        bold: true,
        size: 20,
        color: "magenta",
        colorspace: "cmyk",
      })
      .line(
        [
          [80, 190],
          [100, 190],
        ],
        lineOpt,
      )
      .text("Defining Gold Here", 100, 220, {
        bold: true,
        size: 20,
        color: "#ff9900",
        colorName: "gold",
      })
      .line(
        [
          [80, 220],
          [100, 220],
        ],
        lineOpt,
      )
      .text("Using Gold Here", 100, 250, {
        bold: true,
        size: 20,
        color: "gold",
      })
      .line(
        [
          [80, 250],
          [100, 250],
        ],
        lineOpt,
      )
      .text("Undefined color returns default color", 100, 280, {
        bold: true,
        size: 20,
        color: "undefinedColorGivesDefault",
      })
      .line(
        [
          [80, 280],
          [100, 280],
        ],
        lineOpt,
      )
      .chroma("!load", rgbColors)
      .text("Burlywood from file load", 100, 310, {
        bold: true,
        size: 20,
        color: "burlywood",
      })
      .line(
        [
          [80, 310],
          [100, 310],
        ],
        lineOpt,
      )
      .endPage()
      .endPDF(done);
  });

  it("Special Color Space Names", (done) => {
    const output = path.join(__dirname, "../output/color-special.pdf");
    const lineOpt = { lineWidth: 0.5 };
    const recipe = new Recipe(output, output, {
      colorspace: "separation",
    });
    recipe
      .editPage(1)
      .chroma("purple", [255, 0, 255], "separation")
      .text("Separation color purple", 100, 460, {
        bold: true,
        size: 20,
        color: "purple",
      })
      .line(
        [
          [80, 460],
          [100, 460],
        ],
        lineOpt,
      )
      .text("Separation color orange", 100, 490, {
        bold: true,
        size: 20,
        color: [255, 69, 0],
        colorName: "orange",
      })
      .line(
        [
          [80, 490],
          [100, 490],
        ],
        lineOpt,
      )
      .text("Pantone 1505 C, RGB", 100, 520, {
        bold: true,
        size: 20,
        color: [255, 105, 0],
        colorName: "PANTONE 1505 C",
      })
      .line(
        [
          [80, 520],
          [100, 520],
        ],
        lineOpt,
      )
      .text("Pantone 1505 C, CMYK", 100, 550, {
        bold: true,
        size: 20,
        color: "%0,56,90,0",
        colorName: "PANTONE 1505 C",
      })
      .line(
        [
          [80, 550],
          [100, 550],
        ],
        lineOpt,
      )
      .text("CMYK Direct", 100, 580, {
        bold: true,
        size: 20,
        color: "%0,56,90,0",
        colorspace: "cmyk",
      })
      .line(
        [
          [80, 580],
          [100, 580],
        ],
        lineOpt,
      )
      .text("Nan, a great PDF collaborator!", 100, 360, {
        bold: true,
        size: 30,
        color: "nans",
      })
      .endPage()
      .endPDF(done);
  });

  it("exposes frozen colorspace constants valued as in Wasm", () => {
    const assert = require("node:assert/strict");
    assert.deepEqual(Recipe.Colorspace, {
      RGB: "rgb",
      CMYK: "cmyk",
      GRAY: "gray",
      SEPARATION: "separation",
    });
    assert.deepEqual(muhammara.DeviceColorSpace, {
      RGB: "rgb",
      GRAY: "gray",
      CMYK: "cmyk",
    });
    assert.ok(Object.isFrozen(Recipe.Colorspace));
    assert.ok(Object.isFrozen(muhammara.DeviceColorSpace));
  });

  it("writes the separation color space into every document", () => {
    const assert = require("node:assert/strict");
    const fs = require("fs");
    const draw = (name) => {
      const output = path.join(__dirname, `../output/${name}.pdf`);
      new Recipe("new", output)
        .createPage(100, 100)
        .rectangle(10, 10, 20, 20, { fill: "nans", colorspace: "separation" })
        .endPage()
        .endPDF();
      return fs.readFileSync(output, "latin1");
    };
    draw("separation-first");
    assert.match(draw("separation-second"), /\/Separation/);
  });

  ["new", "edited"].forEach((mode) => {
    it(`draws separation colors on ${mode} pages`, () => {
      const assert = require("node:assert/strict");
      const fs = require("fs");
      const source = path.join(__dirname, "../output/separation-source.pdf");
      new Recipe("new", source).createPage(200, 200).endPage().endPDF();
      const output = path.join(__dirname, `../output/separation-${mode}.pdf`);
      const recipe =
        mode === "new"
          ? new Recipe("new", output).createPage(200, 200)
          : new Recipe(source, output).editPage(1);
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
        .rectangle(10, 120, 40, 40, {
          fill: "#0000ff",
          colorspace: "separation",
        })
        .endPage()
        .endPDF();
      const raw = fs.readFileSync(output, "latin1");
      assert.equal(
        raw.match(/\/Separation \/SpotOrange \/DeviceRGB/g)?.length,
        1,
      );
      assert.equal(
        raw.match(/\/Separation \/SpotGreen \/DeviceCMYK/g)?.length,
        1,
      );
      assert.equal(recipe.knownColors.separation.SpotGreen, "00ff0000");

      // Every separation drawing is a form XObject that selects its color:
      // fills, both texts and the colorName circle with cs, the line and the
      // underline with CS. The #0000ff rectangle keeps its device color.
      const reader = muhammara.createReader(output);
      const content = [];
      for (let id = 1; id < reader.getXrefSize(); id++) {
        const object = reader.parseNewObject(id);
        if (!object || object.getType() !== muhammara.ePDFObjectStream) {
          continue;
        }
        const stream = object.toPDFStream();
        const dictionary = stream.getDictionary();
        if (
          !dictionary.exists("Subtype") ||
          dictionary.queryObject("Subtype").value !== "Form"
        ) {
          continue;
        }
        const input = reader.startReadingFromStream(stream);
        const bytes = [];
        while (input.notEnded()) bytes.push(...input.read(4096));
        content.push(Buffer.from(bytes).toString("latin1"));
      }
      const all = content.join("\n");
      assert.equal(all.match(/\/\S+ cs\s+1 scn/g)?.length, 4);
      // line() strokes only its segments, with no zero-length first one.
      assert.equal(all.match(/\/\S+ CS\s+1 SCN/g)?.length, 2);
      assert.match(all, /0 0 1 rg/);
    });
  });
});
