// Byte-first port of the text workflows in docs/tests/modify-pdfs.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm, createRecipe } from "../index.js";
import { writeOutput } from "../testOutput.mjs";

var FONT = "modify-pdfs-font";

/**
 * Writes a page with text in a simple font (`FN1`) and, for characters outside
 * WinAnsi, a composite font (`FN2`).
 *
 * @param {object} muhammara Loaded Wasm API with the test font registered.
 * @returns {Uint8Array} PDF bytes.
 */
function statusPdf(muhammara) {
  var writer = muhammara.createWriter();
  var page = writer.createPage(0, 0, 200, 200);
  writer
    .startPageContentContext(page)
    .BT()
    .Tf(writer.getFontForBytes(FONT), 12)
    .Tm(1, 0, 0, 1, 20, 30)
    .Tj("Draft")
    .Tm(1, 0, 0, 1, 20, 60)
    .Tj("Status: in Prüfung")
    .Tm(1, 0, 0, 1, 20, 90)
    .Tj("Status: geprüft")
    .Tm(1, 0, 0, 1, 20, 120)
    .Tj("Größe Ω")
    .ET();
  writer.writePage(page);
  return writer.end();
}

/**
 * Underlines existing text as the annotate-existing-text how-to does.
 *
 * @param {object} muhammara Loaded Wasm API.
 * @param {Function} Recipe Wasm Recipe class.
 * @param {Blob} inputFile Source PDF.
 * @param {string} text Decoded text to mark.
 * @returns {Promise<Uint8Array>} Annotated PDF bytes.
 */
async function annotateExistingText(muhammara, Recipe, inputFile, text) {
  var inputBytes = new Uint8Array(await inputFile.arrayBuffer());
  var reader = await muhammara.createReaderAsync(inputFile);
  var pageNumber = 1; // Recipe pages are one-based.
  var pageIndex = pageNumber - 1; // Reader pages are zero-based.
  var matches;

  try {
    matches = reader.extractPageText(pageIndex).filter(function (element) {
      return element.text === text;
    });
  } finally {
    reader.end();
  }

  var pdf = new Recipe(inputBytes);
  var page = pdf.pageInfo(pageNumber);

  pdf.editPage(pageNumber);
  matches.forEach(function (match) {
    pdf.annot(
      match.textMatrix[4],
      page.height - match.textMatrix[5] - match.fontSize,
      Recipe.AnnotSubtype.UNDERLINE,
      {
        width: 28,
        height: match.fontSize,
        color: "#008000",
        text: "Reviewed",
      },
    );
  });
  return pdf.endPage().endPDF();
}

/**
 * Reads the decoded text of each text-showing operation on a page, as the
 * replace-text how-to does.
 *
 * @param {object} muhammara Loaded Wasm API.
 * @param {Uint8Array} bytes PDF bytes.
 * @param {number} pageIndex Zero-based page index.
 * @returns {string[]} Decoded texts.
 */
function pageTexts(muhammara, bytes, pageIndex) {
  var reader = muhammara.createReader(bytes);

  try {
    return reader.extractPageText(pageIndex).map(function (element) {
      return element.text;
    });
  } finally {
    reader.end();
  }
}

/**
 * Replaces page text as the replace-text how-to does.
 *
 * @param {object} muhammara Loaded Wasm API.
 * @param {Function} Recipe Wasm Recipe class.
 * @param {Uint8Array} inputBytes Source PDF bytes.
 * @param {number} pageNumber One-based page number.
 * @param {string} text Text to replace.
 * @param {string} replacement Replacement text.
 * @returns {{bytes: Uint8Array, changed: number}} New PDF bytes and the number
 * of changed text operations.
 */
function replacePageText(
  muhammara,
  Recipe,
  inputBytes,
  pageNumber,
  text,
  replacement,
) {
  var outputBytes = new Recipe(inputBytes)
    .replaceText(text, replacement, pageNumber)
    .endPDF();

  var pageIndex = pageNumber - 1; // Reader pages are zero-based.
  var after = pageTexts(muhammara, outputBytes, pageIndex);
  var changed = pageTexts(muhammara, inputBytes, pageIndex).filter(
    function (before, index) {
      return before === text && after[index] === replacement;
    },
  ).length;
  return { bytes: outputBytes, changed: changed };
}

/**
 * Lists a page's annotation subtypes and contents.
 *
 * @param {object} muhammara Loaded Wasm API.
 * @param {Uint8Array} bytes PDF bytes.
 * @returns {Array<[string, string]>} Subtype and contents per annotation.
 */
function readAnnotations(muhammara, bytes) {
  var reader = muhammara.createReader(bytes);

  try {
    var annotations = reader.queryDictionaryObject(
      reader.parsePageDictionary(0),
      "Annots",
    );
    return annotations.toJSArray().map(function (item) {
      var reference = item.toPDFIndirectObjectReference();
      var annotation = (
        reference ? reader.parseNewObject(reference.getObjectID()) : item
      ).toPDFDictionary();
      return [
        reader.queryDictionaryObject(annotation, "Subtype").value,
        reader.queryDictionaryObject(annotation, "Contents").toText(),
      ];
    });
  } finally {
    reader.end();
  }
}

describe("ModifyPDFs documentation workflows", function () {
  var muhammara;
  var Recipe;

  before(async function () {
    muhammara = await createMuhammaraWasm();
    Recipe = await createRecipe();
    muhammara.registerFont(
      FONT,
      new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/fonts/arial.ttf",
            import.meta.url,
          ),
        ),
      ),
    );
  });

  after(function () {
    muhammara.unregisterFont(FONT);
    muhammara.disposeAssets();
  });

  it("annotates existing text, including composite-font text", async function () {
    var status = statusPdf(muhammara);
    writeOutput("ModifyPDFs-status", status);
    var inputFile = new Blob([status], { type: "application/pdf" });
    var output = await annotateExistingText(
      muhammara,
      Recipe,
      inputFile,
      "Größe Ω",
    );
    writeOutput("ModifyPDFs-annotated-text", output);

    assert.deepEqual(readAnnotations(muhammara, output), [
      ["Underline", "Reviewed"],
    ]);
  });

  it("replaces non-ASCII text and reports missing glyphs", function () {
    var inputBytes = statusPdf(muhammara);
    var result = replacePageText(
      muhammara,
      Recipe,
      inputBytes,
      1,
      "Status: in Prüfung",
      "Status: geprüft",
    );

    assert.equal(result.changed, 1);
    writeOutput("ModifyPDFs-status-approved", result.bytes);
    var reader = muhammara.createReader(result.bytes);
    var text = reader.extractPageText(0);
    reader.end();
    assert.deepEqual(
      text.map((element) => element.text),
      ["Draft", "Status: geprüft", "Status: geprüft", "Größe Ω"],
    );
    assert.deepEqual(text[1].textMatrix, [1, 0, 0, 1, 20, 60]);

    assert.equal(
      replacePageText(muhammara, Recipe, inputBytes, 1, "missing", "Draft")
        .changed,
      0,
    );
    assert.throws(
      () =>
        replacePageText(
          muhammara,
          Recipe,
          inputBytes,
          1,
          "Status: in Prüfung",
          "Status: abgelehnt",
        ),
      {
        message:
          'replaceText cannot write the replacement: font FN1 has no glyph for "b", "l", "h"',
      },
    );
  });
});
