var assert = require("node:assert/strict");
var muhammara = require("@muhammara/native-with-source");
var fs = require("node:fs");
var path = require("node:path");
var {
  PdfAFeature,
  SRGB_PROFILE,
  imagePdfaFeature,
} = require("../../native-core/lib/pdfa");
var { writeOutput } = require("./helpers/testOutput");

var Recipe = muhammara.Recipe;

// Each level and what a document of it carries; checked against veraPDF.
var LEVELS = [
  {
    level: Recipe.PdfA.A1B,
    header: "%PDF-1.4",
    identification:
      "<pdfaid:part>1</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance>",
  },
];

/**
 * Creates a one page PDF/A document.
 * @param {string} level A Recipe.PdfA value.
 * @param {Object} [options] More Recipe options.
 * @returns {Buffer} The PDF.
 */
function create(level, options) {
  var recipe = new Recipe(
    Buffer.from("new"),
    undefined,
    Object.assign({ pdfa: level, title: "Archived" }, options),
  );
  recipe.createPage("a4").text("Archived text", 50, 50).endPage();
  var bytes = recipe.endPDF(function (output) {
    return output;
  });
  writeOutput("PDFA-" + level, bytes);
  return bytes;
}

/**
 * Reads the output intent the catalog of a PDF points at.
 * @param {Buffer} bytes The PDF.
 * @returns {{intent: Object<string, *>, profile: Buffer, n: number}} The
 *   intent entries, its profile bytes and the profile's component count.
 */
function outputIntent(bytes) {
  var reader = muhammara.createReader(new muhammara.PDFRStreamForBuffer(bytes));
  try {
    var catalog = reader.queryDictionaryObject(reader.getTrailer(), "Root");
    var intents = reader.queryDictionaryObject(catalog, "OutputIntents");
    var intent = reader.queryArrayObject(intents, 0);
    var profile = reader.queryDictionaryObject(intent, "DestOutputProfile");
    var input = reader.startReadingFromStream(profile);
    var chunks = [];
    while (input.notEnded()) chunks.push(Buffer.from(input.read(4096)));
    return {
      intent: Object.fromEntries(
        Object.entries(intent.toJSObject()).map(([key, value]) => [
          key,
          value.toText ? value.toText() : value.value,
        ]),
      ),
      profile: Buffer.concat(chunks),
      n: profile.getDictionary().queryObject("N").value,
    };
  } finally {
    reader.end();
  }
}

describe("PDF/A", function () {
  LEVELS.forEach(function ({ level, header, identification }) {
    describe("PDF/A-" + level, function () {
      var bytes;
      before(function () {
        bytes = create(level);
      });

      it("writes the PDF version of the level", function () {
        assert.equal(bytes.subarray(0, header.length).toString(), header);
      });

      it("identifies the document in its XMP metadata", function () {
        var recipe = new Recipe(bytes);
        var packet = recipe.xmp();
        recipe.endPDF();
        assert.ok(packet.includes(identification), packet);
        assert.ok(packet.includes(">Archived</rdf:li>"));
      });

      it("writes an sRGB output intent", function () {
        var { intent, profile, n } = outputIntent(bytes);
        assert.equal(intent.Type, "OutputIntent");
        assert.equal(intent.S, "GTS_PDFA1");
        assert.equal(intent.OutputConditionIdentifier, "sRGB IEC61966-2.1");
        assert.deepEqual(profile, Buffer.from(SRGB_PROFILE, "base64"));
        assert.equal(n, 3);
      });
    });
  });

  describe("PDF/A-1 content", function () {
    var images = path.join(__dirname, "TestMaterials/images/");

    /**
     * Draws on a PDF/A-1b page.
     * @param {function(Recipe): void} draw Draws on the page.
     * @returns {void}
     */
    function draw(draw) {
      var recipe = new Recipe(Buffer.from("new"), undefined, {
        pdfa: Recipe.PdfA.A1B,
      });
      recipe.createPage("a4");
      draw(recipe);
      recipe.endPage().endPDF(() => {});
    }

    it("rejects transparency", function () {
      var message = { message: "PDF/A-1 does not allow transparency" };
      assert.throws(
        () => draw((r) => r.rectangle(10, 10, 50, 50, { opacity: 0.5 })),
        message,
      );
      assert.throws(
        () => draw((r) => r.image(images + "png/original.png", 10, 10)),
        message,
      );
    });

    it("rejects CMYK colors", function () {
      var message = { message: "PDF/A-1 does not allow CMYK colors" };
      assert.throws(
        () => draw((r) => r.rectangle(10, 10, 50, 50, { color: "#ff00ff00" })),
        message,
      );
      assert.throws(
        () => draw((r) => r.image(images + "cmyk.jpg", 10, 10)),
        message,
      );
    });

    it("draws what PDF/A-1 allows", function () {
      draw((r) =>
        r
          .rectangle(10, 10, 50, 50, { color: "#ff0000", opacity: 1 })
          .image(images + "png/pnglogo-grr.png", 10, 100, { width: 50 })
          .image(images + "soundcloud_logo.jpg", 10, 200, { width: 50 })
          .text("text", 10, 300, { color: "#00ff00" }),
      );
    });
  });

  it("finds the features images need", function () {
    var images = path.join(__dirname, "TestMaterials/images/");
    var feature = (file) => imagePdfaFeature(fs.readFileSync(images + file));
    assert.equal(feature("png/original.png"), PdfAFeature.TRANSPARENCY);
    assert.equal(
      feature("png/gray-alpha-8-linear.png"),
      PdfAFeature.TRANSPARENCY,
    );
    assert.equal(feature("png/pnglogo-grr.png"), null);
    assert.equal(feature("cmyk.jpg"), PdfAFeature.CMYK);
    assert.equal(feature("grayscale.jpg"), null);
    assert.equal(feature("soundcloud_logo.jpg"), null);
  });

  it("names the levels", function () {
    assert.equal(Recipe.PdfA.A1B, "1B");
    assert.deepEqual(
      LEVELS.map(({ level }) => level),
      Object.values(Recipe.PdfA),
    );
  });

  it("rejects what PDF/A does not allow", function () {
    var source = create(Recipe.PdfA.A1B);
    assert.throws(() => create("1Z"), {
      name: "TypeError",
      message: "Unknown PDF/A level 1Z; use a PdfA value",
    });
    assert.throws(() => create(Recipe.PdfA.A1B, { version: 1.7 }), {
      message: "PDF/A-1 is written as PDF 1.4",
    });
    assert.throws(() => create(Recipe.PdfA.A1B, { userPassword: "u" }), {
      message: "PDF/A does not allow encryption",
    });
    assert.throws(() => new Recipe(source, undefined, { pdfa: "1B" }), {
      message: "The pdfa option applies to a new PDF",
    });
    var recipe = new Recipe(Buffer.from("new"), undefined, { pdfa: "1B" });
    assert.throws(() => recipe.encrypt({ userPassword: "u" }), {
      message: "PDF/A does not allow encryption",
    });
    recipe
      .createPage("a4")
      .endPage()
      .endPDF(() => {});
    assert.doesNotThrow(() => create(Recipe.PdfA.A1B, { version: 1.4 }));
  });
});
