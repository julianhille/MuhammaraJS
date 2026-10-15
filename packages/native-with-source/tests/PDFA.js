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
  ["1B", "%PDF-1.4"],
  ["2B", "%PDF-1.7"],
  ["2U", "%PDF-1.7"],
  ["3B", "%PDF-1.7"],
  ["3U", "%PDF-1.7"],
  ["4", "%PDF-2.0"],
  ["4E", "%PDF-2.0"],
  ["4F", "%PDF-2.0"],
].map(([level, header]) => ({
  level,
  header,
  identification:
    `<pdfaid:part>${level[0]}</pdfaid:part>` +
    (level[1] ? `<pdfaid:conformance>${level[1]}</pdfaid:conformance>` : "") +
    (level[0] === "4" ? "<pdfaid:rev>2020</pdfaid:rev>" : ""),
}));

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
  // PDF/A-4f needs an attached file
  if (option.level === "4F") recipe.attach("data.xml", Buffer.from("<x/>"));
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

/**
 * Reads the flags of the annotations on the first page of a PDF.
 * @param {Buffer} bytes The PDF.
 * @returns {number[]} The /F value of each annotation.
 */
function annotationFlags(bytes) {
  var reader = muhammara.createReader(new muhammara.PDFRStreamForBuffer(bytes));
  try {
    var catalog = reader.queryDictionaryObject(reader.getTrailer(), "Root");
    var pages = reader.queryDictionaryObject(catalog, "Pages");
    var page = reader.queryArrayObject(
      reader.queryDictionaryObject(pages, "Kids"),
      0,
    );
    var annots = reader.queryDictionaryObject(page, "Annots");
    return Array.from(
      { length: annots.getLength() },
      (_, i) => reader.queryArrayObject(annots, i).queryObject("F").value,
    );
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
    assert.equal(Recipe.PdfA.A2B, "2B");
    assert.equal(Recipe.PdfA.A2U, "2U");
    assert.equal(Recipe.PdfA.A3B, "3B");
    assert.equal(Recipe.PdfA.A3U, "3U");
    assert.equal(Recipe.PdfA.A4, "4");
    assert.equal(Recipe.PdfA.A4E, "4E");
    assert.equal(Recipe.PdfA.A4F, "4F");
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

  describe("PDF/A-2 content", function () {
    it("allows transparency", function () {
      create(pdfa("2B"), {}, (r) =>
        r
          .rectangle(10, 10, 50, 50, { color: "#ff0000", opacity: 0.5 })
          .image(images + "png/original.png", 10, 100, { width: 50 })
          .comment("note", 50, 300, { opacity: 0.5 }),
      );
    });

    it("rejects annotations without an appearance stream", function () {
      assert.throws(
        () =>
          create(pdfa("2U"), {}, (r) =>
            r.annot(50, 400, "Highlight", { width: 100, height: 20 }),
          ),
        {
          message:
            "PDF/A-2 does not allow annotations without an appearance stream",
        },
      );
      assert.throws(() => create(pdfa("2B"), { version: 1.4 }), {
        message: "PDF/A-2 is written as PDF 1.7",
      });
    });
  });

  describe("PDF/A-4", function () {
    it("keeps the document information in XMP only", function () {
      var bytes = create(pdfa("4"), { author: "Someone" }, (r) =>
        r.info({ subject: "About" }).comment("note", 50, 300),
      );
      assert.doesNotMatch(Buffer.from(bytes).toString("latin1"), /\/Info/);
      var recipe = new Recipe(bytes);
      var packet = recipe.xmp();
      recipe.endPDF();
      ["Archived", "Someone", "About"].forEach((value) =>
        assert.ok(packet.includes(">" + value + "<"), value),
      );
      assert.ok(packet.includes("<xmp:CreateDate>"));
    });

    it("rejects custom Info entries, which have no place", function () {
      var message = { message: "PDF/A-4 does not allow custom Info entries" };
      assert.throws(
        () => create(pdfa("4E"), {}, (r) => r.custom("ReportId", "X")),
        message,
      );
      assert.throws(
        () => create(pdfa("4"), {}, (r) => r.info({ ReportId: "X" })),
        message,
      );
      assert.throws(() => create(pdfa("4"), { version: 1.7 }), {
        message: "PDF/A-4 is written as PDF 2.0",
      });
    });
  });

  describe("attached files", function () {
    it("allows them where the level does", function () {
      ["3B", "3U", "4F"].forEach((level) =>
        create(pdfa(level), {}, (r) =>
          r.attach("invoice.xml", Buffer.from("<x/>"), {
            mimeType: "text/xml",
            relationship: Recipe.AFRelationship.DATA,
          }),
        ),
      );
    });

    it("rejects them where the level does not", function () {
      [
        ["1B", "PDF/A-1"],
        ["2B", "PDF/A-2"],
        ["2U", "PDF/A-2"],
        ["4", "PDF/A-4"],
        ["4E", "PDF/A-4"],
      ].forEach(([level, name]) =>
        assert.throws(
          () =>
            create(pdfa(level), {}, (r) => r.attach("a", Buffer.from("<x/>"))),
          { message: name + " does not allow attached files" },
        ),
      );
    });

    it("needs one in PDF/A-4f", function () {
      var recipe = new Recipe(Buffer.from("new"), undefined, {
        pdfa: pdfa("4F"),
      });
      recipe.createPage("a4").endPage();
      assert.throws(() => recipe.endPDF(() => {}), {
        message: "PDF/A-4f needs an attached file",
      });
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

  describe("annotations", function () {
    it("flags them for printing", function () {
      var bytes = create(pdfa("1B"), {}, (r) =>
        r
          .comment("note", 50, 350)
          .annot(50, 400, "Highlight", { width: 100, height: 20 })
          .annot(50, 450, "Square", {
            width: 10,
            height: 10,
            flag: "readonly",
          }),
      );
      assert.deepEqual(annotationFlags(bytes), [4, 4, 68]);
      // the objects of each section start on their own line
      assert.doesNotMatch(Buffer.from(bytes).toString("latin1"), /%%EOF\d/);
    });

    it("rejects hidden and transparent ones", function () {
      ["hidden", "invisible", "noview"].forEach((flag) =>
        assert.throws(
          () =>
            create(pdfa("1B"), {}, (r) => r.comment("note", 50, 50, { flag })),
          { message: "PDF/A does not allow hidden annotations" },
        ),
      );
      assert.throws(
        () =>
          create(pdfa("1B"), {}, (r) =>
            r.comment("note", 50, 50, { opacity: 0.5 }),
          ),
        { message: "PDF/A-1 does not allow transparency" },
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
