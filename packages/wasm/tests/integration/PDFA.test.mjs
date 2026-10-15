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
].map(([level, header]) => ({
  level,
  header,
  identification:
    `<pdfaid:part>${level[0]}</pdfaid:part>` +
    `<pdfaid:conformance>${level[1]}</pdfaid:conformance>`,
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
 * @returns {Uint8Array} The PDF.
 */
function create(option, options, draw) {
  var recipe = new Recipe({ pdfa: option, title: "Archived", ...options });
  recipe.createPage("a4").text("Archived text", 50, 50);
  if (draw) draw(recipe);
  var bytes = recipe.endPage().endPDF();
  writeOutput("PDFA-" + option.level, bytes);
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

describe("PDF/A", function () {
  before(async function () {
    muhammara = await createMuhammaraWasm();
    Recipe = await createRecipe();
  });

  LEVELS.forEach(function ({ level, header, identification }) {
    describe("PDF/A-" + level, function () {
      var bytes;
      before(function () {
        bytes = create(pdfa(level));
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

    it("draws what PDF/A-1 allows", function () {
      create(pdfa("1B"), {}, (r) =>
        r
          .rectangle(10, 10, 50, 50, { color: "#ff0000", opacity: 1 })
          .image(image("png/pnglogo-grr.png"), 10, 100, { width: 50 })
          .image(image("soundcloud_logo.jpg"), 10, 200, { width: 50 })
          .text("text", 10, 300, { color: "#00ff00" }),
      );
    });
  });

  describe("PDF/A-2 content", function () {
    it("allows transparency", function () {
      create(pdfa("2B"), {}, (r) =>
        r
          .rectangle(10, 10, 50, 50, { color: "#ff0000", opacity: 0.5 })
          .image(image("png/original.png"), 10, 100, { width: 50 })
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
