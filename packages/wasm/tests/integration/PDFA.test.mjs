// Ports tests/PDFA.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm, createRecipe } from "../../index.js";
import { SRGB_PROFILE } from "../../lib/pdfa.js";
import { writeOutput } from "../testOutput.mjs";

describe("PDF/A", function () {
  var muhammara;
  var Recipe;
  // Each level and what a document of it carries; checked against veraPDF.
  var LEVELS = [
    {
      level: "1B",
      header: "%PDF-1.4",
      identification:
        "<pdfaid:part>1</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance>",
    },
  ];

  before(async function () {
    muhammara = await createMuhammaraWasm();
    Recipe = await createRecipe();
  });

  /**
   * Creates a one page PDF/A document.
   * @param {string} level A Recipe.PdfA value.
   * @param {object} [options] More Recipe options.
   * @returns {Uint8Array} The PDF.
   */
  function create(level, options) {
    var recipe = new Recipe({ pdfa: level, title: "Archived", ...options });
    recipe.createPage("a4").text("Archived text", 50, 50).endPage();
    var bytes = recipe.endPDF();
    writeOutput("PDFA-" + level, bytes);
    return bytes;
  }

  /**
   * Reads the output intent the catalog of a PDF points at.
   * @param {Uint8Array} bytes The PDF.
   * @returns {{intent: Record<string, unknown>, profile: Uint8Array, n: number}}
   *   The intent entries, its profile bytes and the profile's component count.
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

  describe("levels", function () {
    for (const { level, header, identification } of LEVELS) {
      describe("PDF/A-" + level, function () {
        var bytes;
        before(function () {
          bytes = create(level);
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

        it("writes an sRGB output intent", function () {
          var { intent, profile, n } = outputIntent(bytes);
          assert.equal(intent.Type, "OutputIntent");
          assert.equal(intent.S, "GTS_PDFA1");
          assert.equal(intent.OutputConditionIdentifier, "sRGB IEC61966-2.1");
          assert.deepEqual(
            profile,
            Uint8Array.from(atob(SRGB_PROFILE), (c) => c.charCodeAt(0)),
          );
          assert.equal(n, 3);
        });
      });
    }
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
    assert.throws(() => new Recipe(source, { pdfa: "1B" }), {
      message: "The pdfa option applies to a new PDF",
    });
    var recipe = new Recipe({ pdfa: "1B" });
    assert.throws(() => recipe.encrypt({ userPassword: "u" }), {
      message: "PDF/A does not allow encryption",
    });
    recipe.createPage("a4").endPage().endPDF();
    assert.doesNotThrow(() => create(Recipe.PdfA.A1B, { version: 1.4 }));
    assert.doesNotThrow(() => create(Recipe.PdfA.A1B, { version: 14 }));
  });
});
