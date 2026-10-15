var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var muhammara = require("@muhammara/native-with-source");
var { PdfAFeature, imagePdfaFeatures } = require("../../native-core/lib/pdfa");
var { writeOutput } = require("./helpers/testOutput");

var Recipe = muhammara.Recipe;
var images = path.join(__dirname, "TestMaterials/images/");
var profilePath = path.join(__dirname, "TestMaterials/icc/sRGB-v2-micro.icc");
var PROFILE = fs.readFileSync(profilePath);

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
 * A copy of the sRGB test profile with another color space or version in its
 * header, for the checks of the profile; not a usable profile.
 * @param {number} at The header offset.
 * @param {string} value The bytes to put there, as latin1.
 * @returns {Buffer} The changed profile.
 */
function changedProfile(at, value) {
  var copy = Buffer.from(PROFILE);
  copy.write(value, at, "latin1");
  return copy;
}

/**
 * The pdfa option for a level with the sRGB test profile.
 * @param {string} level A Recipe.PdfA value.
 * @param {Object} [more] Options that replace the defaults.
 * @returns {Object} The option.
 */
function pdfa(level, more) {
  return Object.assign(
    { level, iccProfile: PROFILE, outputCondition: "sRGB IEC61966-2.1" },
    more,
  );
}

/**
 * Creates a one page PDF/A document.
 * @param {Object} option The pdfa option.
 * @param {Object} [options] More Recipe options.
 * @param {function(Recipe): void} [draw] Draws on the page.
 * @returns {Buffer} The PDF.
 */
function create(option, options, draw) {
  var recipe = new Recipe(
    Buffer.from("new"),
    undefined,
    Object.assign({ pdfa: option, title: "Archived" }, options),
  );
  recipe.createPage("a4").text("Archived text", 50, 50);
  if (draw) draw(recipe);
  var bytes = recipe.endPage().endPDF((output) => output);
  writeOutput("PDFA-" + option.level, bytes);
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
        bytes = create(pdfa(level));
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

      it("writes the output intent with the given profile", function () {
        var { intent, profile, n } = outputIntent(bytes);
        assert.equal(intent.Type, "OutputIntent");
        assert.equal(intent.S, "GTS_PDFA1");
        assert.equal(intent.OutputConditionIdentifier, "sRGB IEC61966-2.1");
        assert.deepEqual(profile, PROFILE);
        assert.equal(n, 3);
      });
    });
  });

  it("names the levels", function () {
    assert.equal(Recipe.PdfA.A1B, "1B");
    assert.deepEqual(
      LEVELS.map(({ level }) => level),
      Object.values(Recipe.PdfA),
    );
  });

  it("takes the profile as a path", function () {
    var bytes = create(pdfa("1B", { iccProfile: profilePath }));
    assert.deepEqual(outputIntent(bytes).profile, PROFILE);
  });

  it("names the output condition Custom unless it is given", function () {
    var bytes = create(pdfa("1B", { outputCondition: undefined }));
    assert.equal(
      outputIntent(bytes).intent.OutputConditionIdentifier,
      "Custom",
    );
  });

  it("rejects what PDF/A does not allow", function () {
    var source = create(pdfa("1B"));
    assert.throws(() => create(pdfa("1Z")), {
      name: "TypeError",
      message: "Unknown PDF/A level 1Z; use a PdfA value",
    });
    assert.throws(() => create(pdfa("1B", { iccProfile: undefined })), {
      name: "TypeError",
      message: "pdfa.iccProfile must be the bytes of an ICC profile",
    });
    assert.throws(() => create(pdfa("1B", { iccProfile: Buffer.alloc(200) })), {
      name: "TypeError",
      message: "pdfa.iccProfile must be the bytes of an ICC profile",
    });
    assert.throws(
      () => create(pdfa("1B", { iccProfile: changedProfile(16, "Lab ") })),
      { message: "pdfa.iccProfile must be an RGB, CMYK or gray profile" },
    );
    assert.throws(
      () => create(pdfa("1B", { iccProfile: changedProfile(8, "\u0004") })),
      { message: "PDF/A-1 needs an ICC profile of version 2 or earlier" },
    );
    assert.throws(() => create(pdfa("1B"), { version: 1.7 }), {
      message: "PDF/A-1 is written as PDF 1.4",
    });
    assert.throws(() => create(pdfa("1B"), { userPassword: "u" }), {
      message: "PDF/A does not allow encryption",
    });
    assert.throws(() => new Recipe(source, undefined, { pdfa: pdfa("1B") }), {
      message: "The pdfa option applies to a new PDF",
    });
    var recipe = new Recipe(Buffer.from("new"), undefined, {
      pdfa: pdfa("1B"),
    });
    assert.throws(() => recipe.encrypt({ userPassword: "u" }), {
      message: "PDF/A does not allow encryption",
    });
    recipe
      .createPage("a4")
      .endPage()
      .endPDF(() => {});
    assert.doesNotThrow(() => create(pdfa("1B"), { version: 1.4 }));
  });

  describe("PDF/A-1 content", function () {
    it("rejects transparency", function () {
      var message = { message: "PDF/A-1 does not allow transparency" };
      assert.throws(
        () =>
          create(pdfa("1B"), {}, (r) =>
            r.rectangle(10, 10, 50, 50, { opacity: 0.5 }),
          ),
        message,
      );
      assert.throws(
        () =>
          create(pdfa("1B"), {}, (r) =>
            r.image(images + "png/original.png", 10, 10),
          ),
        message,
      );
    });

    it("draws what PDF/A-1 allows", function () {
      create(pdfa("1B"), {}, (r) =>
        r
          .rectangle(10, 10, 50, 50, { color: "#ff0000", opacity: 1 })
          .image(images + "png/pnglogo-grr.png", 10, 100, { width: 50 })
          .image(images + "soundcloud_logo.jpg", 10, 200, { width: 50 })
          .text("text", 10, 300, { color: "#00ff00" }),
      );
    });
  });

  describe("device colors", function () {
    it("allows only the colors of the profile's color space and gray", function () {
      var rgb = {
        message: "PDF/A with the RGB output intent does not allow CMYK colors",
      };
      assert.throws(
        () =>
          create(pdfa("1B"), {}, (r) =>
            r.rectangle(10, 10, 50, 50, { color: "#ff00ff00" }),
          ),
        rgb,
      );
      assert.throws(
        () =>
          create(pdfa("1B"), {}, (r) => r.image(images + "cmyk.jpg", 10, 10)),
        rgb,
      );

      var cmyk = pdfa("1B", { iccProfile: changedProfile(16, "CMYK") });
      var cmykMessage = {
        message: "PDF/A with the CMYK output intent does not allow RGB colors",
      };
      assert.throws(
        () =>
          create(cmyk, {}, (r) =>
            r.rectangle(10, 10, 50, 50, { color: "#ff0000" }),
          ),
        cmykMessage,
      );
      assert.throws(
        () =>
          create(cmyk, {}, (r) =>
            r.image(images + "soundcloud_logo.jpg", 10, 10),
          ),
        cmykMessage,
      );
      var bytes = create(cmyk, { colorspace: Recipe.Colorspace.CMYK }, (r) =>
        r
          .rectangle(10, 10, 50, 50, { color: "#ff00ff00" })
          .rectangle(10, 100, 50, 50, { color: "#80" }),
      );
      assert.equal(outputIntent(bytes).n, 4);

      var gray = pdfa("1B", { iccProfile: changedProfile(16, "GRAY") });
      assert.throws(
        () =>
          create(gray, {}, (r) =>
            r.rectangle(10, 10, 50, 50, { color: "#ff0000" }),
          ),
        {
          message:
            "PDF/A with the gray output intent does not allow RGB colors",
        },
      );
      assert.equal(
        outputIntent(create(gray, { colorspace: Recipe.Colorspace.GRAY })).n,
        1,
      );
    });
  });

  it("finds the features images need", function () {
    var features = (file) => imagePdfaFeatures(fs.readFileSync(images + file));
    var { RGB, CMYK, TRANSPARENCY } = PdfAFeature;
    assert.deepEqual(features("png/original.png"), [RGB, TRANSPARENCY]);
    assert.deepEqual(features("png/gray-alpha-8-linear.png"), [TRANSPARENCY]);
    assert.deepEqual(features("png/gray-16-linear.png"), []);
    assert.deepEqual(features("png/pnglogo-grr.png"), [RGB]);
    assert.deepEqual(features("cmyk.jpg"), [CMYK]);
    assert.deepEqual(features("grayscale.jpg"), []);
    assert.deepEqual(features("soundcloud_logo.jpg"), [RGB]);
  });
});
