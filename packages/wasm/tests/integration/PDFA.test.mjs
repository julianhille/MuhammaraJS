// Ports tests/PDFA.js.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMuhammaraWasm, createRecipe } from "../../index.js";
import { PdfAFeature, imagePdfaFeatures } from "../../lib/pdfa.js";
import { writeOutput } from "../testOutput.mjs";

var materials = new URL(
  "../../../native-with-source/tests/TestMaterials/",
  import.meta.url,
);
// sRGB-v2-micro.icc is the CC0 profile of Compact ICC Profiles
// (https://github.com/saucecontrol/Compact-ICC-Profiles).
var PROFILE = new Uint8Array(
  readFileSync(new URL("icc/sRGB-v2-micro.icc", materials)),
);
var muhammara;
var Recipe;

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
 * @returns {Uint8Array} The changed profile.
 */
function changedProfile(at, value) {
  var copy = PROFILE.slice();
  copy.set(
    Array.from(value, (c) => c.charCodeAt(0)),
    at,
  );
  return copy;
}

/**
 * Registers a shared image fixture under its file name.
 * @param {string} file The file under TestMaterials/images.
 * @returns {string} The registered name.
 */
function image(file) {
  Recipe.registerImage(
    file,
    readFileSync(new URL("images/" + file, materials)),
    file.endsWith(".png") ? "png" : "jpeg",
  );
  return file;
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
 * @param {string} [sample] Writes the PDF to tests/output as
 *   `PDFA-<level>[-<case>].pdf`, which `npm run test:pdfa` validates with
 *   veraPDF; give it only to documents that must conform.
 * @returns {Uint8Array} The PDF.
 */
function create(option, options, draw, sample) {
  var recipe = new Recipe({ pdfa: option, title: "Archived", ...options });
  recipe.createPage("a4").text("Archived text", 50, 50);
  // PDF/A-4f needs an attached file
  if (option.level === "4F")
    recipe.attach("data.xml", new TextEncoder().encode("<x/>"));
  if (draw) draw(recipe);
  var bytes = recipe.endPage().endPDF();
  if (sample) writeOutput("PDFA-" + sample, bytes);
  return bytes;
}

/**
 * Reads the output intent the catalog of a PDF points at.
 * @param {Uint8Array} bytes The PDF.
 * @returns {{intent: Object<string, *>, profile: Uint8Array, n: number}} The
 *   intent entries, its profile bytes and the profile's component count.
 */
function outputIntent(bytes) {
  var reader = muhammara.createReader(bytes);
  try {
    var catalog = reader.queryDictionaryObject(reader.getTrailer(), "Root");
    var intents = reader.queryDictionaryObject(catalog, "OutputIntents");
    var intent = reader.queryArrayObject(intents, 0);
    var profile = reader.queryDictionaryObject(intent, "DestOutputProfile");
    var input = reader.startReadingFromStream(profile);
    var chunks = [];
    while (input.notEnded()) chunks.push(...input.read(4096));
    return {
      intent: Object.fromEntries(
        Object.entries(intent.toJSObject()).map(([key, value]) => [
          key,
          value.toText ? value.toText() : value.value,
        ]),
      ),
      profile: Uint8Array.from(chunks),
      n: profile.getDictionary().queryObject("N").value,
    };
  } finally {
    reader.end();
  }
}

/**
 * Reads the flags of the annotations on the first page of a PDF.
 * @param {Uint8Array} bytes The PDF.
 * @returns {number[]} The /F value of each annotation.
 */
function annotationFlags(bytes) {
  var reader = muhammara.createReader(bytes);
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

/**
 * Reads the decoded content of the first page of a PDF.
 * @param {Uint8Array} bytes The PDF.
 * @returns {string} The content streams, as latin1.
 */
function pageContent(bytes) {
  var reader = muhammara.createReader(bytes);
  try {
    var page = reader.parsePage(0).getDictionary();
    var contents = reader.queryDictionaryObject(page, "Contents");
    var streams =
      contents.getType() === muhammara.ePDFObjectArray
        ? Array.from({ length: contents.getLength() }, (_, i) =>
            reader.queryArrayObject(contents, i),
          )
        : [contents];
    return streams
      .map((stream) => {
        var input = reader.startReadingFromStream(stream);
        var chunks = [];
        while (input.notEnded()) chunks.push(...input.read(4096));
        return new TextDecoder("latin1").decode(Uint8Array.from(chunks));
      })
      .join("\n");
  } finally {
    reader.end();
  }
}

describe("PDF/A", function () {
  before(async function () {
    muhammara = await createMuhammaraWasm();
    Recipe = await createRecipe();
  });

  LEVELS.forEach(function ({ level, header, identification }) {
    describe("PDF/A-" + level, function () {
      var bytes;
      before(function () {
        // a sample of what the level allows, for veraPDF
        bytes = create(
          pdfa(level),
          {},
          (r) => {
            r.link("https://example.com", 50, 100, 100, 20)
              .comment("note", 50, 150)
              .image(image("soundcloud_logo.jpg"), 50, 200, { width: 50 });
            if (level[0] !== "1") {
              r.rectangle(50, 300, 50, 50, { color: "#ff0000", opacity: 0.5 });
            }
            if (level[0] === "3")
              r.attach("data.xml", new TextEncoder().encode("<x/>"));
          },
          level,
        );
      });

      it("writes the PDF version of the level", function () {
        assert.equal(
          new TextDecoder().decode(bytes.subarray(0, header.length)),
          header,
        );
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

  it("takes the profile as an ArrayBuffer", function () {
    var bytes = create(pdfa("1B", { iccProfile: PROFILE.slice().buffer }));
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
    assert.throws(
      () => create(pdfa("1B", { iccProfile: new Uint8Array(200) })),
      {
        name: "TypeError",
        message: "pdfa.iccProfile must be the bytes of an ICC profile",
      },
    );
    assert.throws(
      () => create(pdfa("1B", { iccProfile: changedProfile(16, "Lab ") })),
      { message: "pdfa.iccProfile must be an RGB, CMYK or gray profile" },
    );
    assert.throws(
      () => create(pdfa("1B", { iccProfile: changedProfile(8, "\u0004") })),
      { message: "PDF/A-1 needs an ICC profile of version 2 or earlier" },
    );
    assert.throws(() => create(pdfa("1B", { outputCondition: 42 })), {
      name: "TypeError",
      message: "pdfa.outputCondition must be a string",
    });
    assert.throws(
      () => create(pdfa("2B", { iccProfile: changedProfile(8, "\u0005") })),
      { message: "PDF/A-2 needs an ICC profile of version 4 or earlier" },
    );
    assert.throws(
      () => create(pdfa("1B", { iccProfile: changedProfile(12, "scnr") })),
      {
        message:
          "pdfa.iccProfile must be a monitor or printer (output) profile",
      },
    );
    assert.throws(() => create(pdfa("1B"), { version: 1.7 }), {
      message: "PDF/A-1 is written as PDF 1.4",
    });
    assert.throws(() => create(pdfa("1B"), { userPassword: "u" }), {
      message: "PDF/A does not allow encryption",
    });
    assert.throws(() => new Recipe(source, { pdfa: pdfa("1B") }), {
      message: "The pdfa option applies to a new PDF",
    });
    var recipe = new Recipe({ pdfa: pdfa("1B") });
    assert.throws(() => recipe.encrypt({ userPassword: "u" }), {
      message: "PDF/A does not allow encryption",
    });
    recipe
      .createPage("a4")
      .endPage()
      .endPDF(() => {});
    assert.doesNotThrow(() => create(pdfa("1B"), { version: 1.4 }));
    assert.doesNotThrow(() => create(pdfa("1B"), { version: 14 }));
  });

  describe("PDF/A-1 content", function () {
    it("rejects transparency", function () {
      var message = { message: "PDF/A-1 does not allow transparency" };
      assert.throws(
        () => create(pdfa("1B"), {}, (r) => r.opacity(0.5)),
        message,
      );
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
            r.image(image("png/original.png"), 10, 10),
          ),
        message,
      );
    });

    it("leaves the page as it was after a refused call", function () {
      var cmyk = pdfa("1B", { iccProfile: changedProfile(16, "CMYK") });
      var drawn = (refused) =>
        pageContent(
          create(cmyk, {}, (r) => {
            refused(r);
            r.rectangle(10, 10, 50, 50, { color: "#ff00ff00" });
          }),
        );
      assert.equal(
        drawn((r) => {
          assert.throws(() => r.opacity(0.5));
          assert.throws(() => r.rectangle(10, 10, 50, 50, { opacity: 0.5 }));
          assert.throws(() => r.text("x", 10, 10, { opacity: 0.5 }));
          assert.throws(() => r.text("x", 10, 10, { highlight: true }));
        }),
        drawn(() => {}),
      );
    });

    it("draws what PDF/A-1 allows", function () {
      create(
        pdfa("1B"),
        {},
        (r) =>
          r
            .rectangle(10, 10, 50, 50, { color: "#ff0000", opacity: 1 })
            .image(image("png/pnglogo-grr.png"), 10, 100, { width: 50 })
            .image(image("soundcloud_logo.jpg"), 10, 200, { width: 50 })
            .text("text", 10, 300, { color: "#00ff00" }),
        "1B-content",
      );
    });
  });

  describe("PDF/A-2 content", function () {
    it("allows transparency", function () {
      create(
        pdfa("2B"),
        {},
        (r) =>
          r
            .rectangle(10, 10, 50, 50, { color: "#ff0000", opacity: 0.5 })
            .rectangle(70, 10, 50, 50, {
              color: "#ff0000",
              colorspace: Recipe.Colorspace.SEPARATION,
              colorName: "Spot",
            })
            .image(image("png/original.png"), 10, 100, { width: 50 })
            .comment("note", 50, 300, { opacity: 0.5 })
            .annot(50, 350, "Popup", { width: 100, height: 20 }),
        "2B-transparency",
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
      assert.throws(
        () =>
          create(pdfa("2B"), {}, (r) =>
            r.comment("note", 50, 400, { width: 100 }),
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
      var bytes = create(
        pdfa("4"),
        { author: "Someone" },
        (r) => r.info({ subject: "About" }).comment("note", 50, 300),
        "4-xmp",
      );
      assert.doesNotMatch(new TextDecoder("latin1").decode(bytes), /\/Info/);
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
        create(
          pdfa(level),
          {},
          (r) =>
            r.attach("invoice.xml", new TextEncoder().encode("<x/>"), {
              mimeType: "text/xml",
              relationship: Recipe.AFRelationship.DATA,
            }),
          level + "-attached",
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
            create(pdfa(level), {}, (r) =>
              r.attach("a", new TextEncoder().encode("<x/>")),
            ),
          { message: name + " does not allow attached files" },
        ),
      );
    });

    it("needs one in PDF/A-4f", function () {
      var recipe = new Recipe({ pdfa: pdfa("4F") });
      recipe.createPage("a4").endPage();
      assert.throws(() => recipe.endPDF(), {
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
        () => create(pdfa("1B"), {}, (r) => r.image(image("cmyk.jpg"), 10, 10)),
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
            r.image(image("soundcloud_logo.jpg"), 10, 10),
          ),
        cmykMessage,
      );
      // the default colors are the output intent's
      var bytes = create(cmyk, {}, (r) =>
        r
          .rectangle(10, 10, 50, 50, { color: "#ff00ff00" })
          .rectangle(10, 100, 50, 50, { color: "#80" })
          .rectangle(10, 200, 50, 50)
          .rectangle(10, 250, 50, 50, { color: "nonexistent" })
          .rectangle(10, 275, 50, 50, { color: "absent" })
          // a spot color without a color of its own has a CMYK alternate
          .rectangle(10, 325, 50, 50, {
            colorspace: Recipe.Colorspace.SEPARATION,
            colorName: "Spot",
            fill: "#0000ff00",
          })
          .text("ink", 10, 350, {
            colorspace: Recipe.Colorspace.SEPARATION,
            colorName: "Ink",
          })
          .image(image("cmyk.jpg"), 10, 300),
      );
      assert.equal(outputIntent(bytes).n, 4);
      // html style colors take the Recipe colorspace too
      create(cmyk, { colorspace: Recipe.Colorspace.CMYK }, (r) =>
        r.text('<p style="color: red">x</p>', 10, 400, { html: true }),
      );

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
        outputIntent(
          create(gray, {}, (r) =>
            r.rectangle(10, 10, 50, 50).rectangle(10, 100, 50, 50, {
              color: "#80",
            }),
          ),
        ).n,
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
      assert.doesNotMatch(new TextDecoder("latin1").decode(bytes), /%%EOF\d/);
      // and the annotation pass writes no second output intent
      assert.equal(
        new TextDecoder("latin1").decode(bytes).match(/\/OutputIntent\b/g)
          .length,
        1,
      );
    });

    it("rejects hidden and transparent ones", function () {
      ["hidden", "invisible", "noview", "togglenoview"].forEach((flag) =>
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
      assert.throws(
        () =>
          create(pdfa("1B"), {}, (r) =>
            r.comment("note", 50, 50, { replies: [{ opacity: 0.5 }] }),
          ),
        { message: "PDF/A-1 does not allow transparency" },
      );
      // a reply writes `flags` when `flag` is 0
      assert.throws(
        () =>
          create(pdfa("1B"), {}, (r) =>
            r.comment("note", 50, 50, {
              replies: [{ flag: 0, flags: "hidden" }],
            }),
          ),
        { message: "PDF/A does not allow hidden annotations" },
      );
      // when it is queued, not only when it is written
      var queued = new Recipe({ pdfa: pdfa("1B") });
      queued.createPage("a4");
      assert.throws(
        () =>
          queued.comment("note", 50, 50, {
            replies: [{ flag: 0, flags: "hidden" }],
          }),
        { message: "PDF/A does not allow hidden annotations" },
      );
      assert.throws(
        () => create(pdfa("3B"), {}, (r) => r.annot(50, 50, "Sound")),
        { message: "PDF/A does not allow sound annotations" },
      );
      create(pdfa("1B"), {}, (r) =>
        r.comment("note", 50, 50, { replies: [null] }),
      );
    });

    it("rejects colors in PDF/A-1 without an RGB output intent", function () {
      var cmyk = pdfa("1B", { iccProfile: changedProfile(16, "CMYK") });
      var options = { colorspace: Recipe.Colorspace.CMYK };
      var message = {
        message:
          "PDF/A-1 does not allow annotation colors without an RGB output intent",
      };
      assert.throws(
        () =>
          create(cmyk, options, (r) =>
            r.comment("note", 50, 50, { color: "red" }),
          ),
        message,
      );
      assert.throws(
        () =>
          create(cmyk, options, (r) =>
            r.annot(50, 400, "Highlight", { width: 100, height: 20 }),
          ),
        message,
      );
      create(cmyk, options, (r) => r.comment("note", 50, 50));
    });
  });

  it("finds the features images need", function () {
    /**
     * @param {string} file An image of the shared fixtures.
     * @returns {string[]} The features the image needs.
     */
    var features = (file) =>
      imagePdfaFeatures(readFileSync(new URL("images/" + file, materials)));
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
