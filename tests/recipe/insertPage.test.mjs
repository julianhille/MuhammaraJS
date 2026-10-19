import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeEnds, fixture, writeOutput } from "../support/ends.mjs";
import {
  mediaBoxes,
  numberedPdf,
  pageContents,
  pageWidths,
  pdfSource,
} from "../support/composition.mjs";
import { encryption, opens } from "../support/metadata.mjs";

// test.pdf and the long PDF are the same 14 pages, which their content tells
// apart, so an expected page order is a list of one-based page numbers.
var TEST_PDF = "recipe/test.pdf";
var LONG_PDF = "recipe/compressed.tracemonkey-pldi-09.pdf";

describeEnds("Recipe insertPage", function (end) {
  var pages;

  before(function () {
    pages = pageContents(end, readFileSync(fixture(LONG_PDF)));
  });

  /**
   * Assert the output's pages are the given pages of the 14-page fixtures.
   * @param {Uint8Array} bytes - The output.
   * @param {number[]} expected - One-based page numbers, in output order.
   * @returns {void}
   */
  function assertPages(bytes, expected) {
    var contents = pageContents(end, bytes);
    assert.equal(contents.length, expected.length);
    expected.forEach((pageNumber, index) =>
      assert.equal(
        contents[index],
        pages[pageNumber - 1],
        `output page ${index + 1} is page ${pageNumber}`,
      ),
    );
  }

  // https://github.com/galkahana/HummusJS/blob/d4aec0ea9200f702ccea9fcada5a3e955feef65e/src/PDFWriterDriver.cpp#L861
  // https://github.com/galkahana/HummusJS/blob/5d6537c8ab5f1e607efccba49016e56a15e9399b/src/deps/PDFWriter/PDFDocumentHandler.cpp#L664
  it("inserts pages from another PDF after the given pages", function () {
    var long = end.pdf(LONG_PDF);
    var bytes = end
      .openRecipe(TEST_PDF)
      .insertPage(0, long, 3)
      .insertPage(2, long, 3)
      .insertPage(1, long, 10)
      .insertPage(1, long, 4)
      .insertPage(1, long, 2)
      .insertPage(1, long, 2)
      .endPDF();
    writeOutput(end, "insertPage-from-other-pdf", bytes);
    // Pages inserted after the same page keep their call order.
    assertPages(
      bytes,
      [3, 1, 10, 4, 2, 2, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    );
  });

  it("inserts pages after every page and after the last page", function () {
    var insertSource = end.pdf(TEST_PDF);
    var recipe = end.openRecipe(LONG_PDF);
    for (var page = 1; page <= 14; page++) {
      recipe.insertPage(page, insertSource, 2);
    }
    recipe.insertPage(14, insertSource, 1);
    recipe.insertPage(2, insertSource, 2);
    var bytes = recipe.endPDF();
    writeOutput(end, "insertPage-after-every-page", bytes);
    var expected = [];
    for (var original = 1; original <= 14; original++) {
      expected.push(original, 2);
      if (original === 2) expected.push(2);
      if (original === 14) expected.push(1);
    }
    assertPages(bytes, expected);
  });

  it("inserts pages into a PDF that appendPage extended", function () {
    var inserted = pdfSource(
      end,
      "insertPage-square-source",
      end.newRecipe().createPage(300, 300).endPage().endPDF(),
    );
    var appended = pdfSource(
      end,
      "insertPage-appended-source",
      numberedPdf(end, 3),
    );
    var bytes = end
      .openRecipe(numberedPdf(end, 2))
      .appendPage(appended, 3)
      .insertPage(0, inserted, 1)
      .insertPage(3, inserted, 1)
      .endPDF();
    writeOutput(end, "insertPage-after-append", bytes);
    // The appended page counts as page 3, so it is kept and inserted after.
    assert.deepEqual(pageWidths(end, bytes), [300, 101, 102, 103, 300]);
  });

  it("inserts pages into a new PDF", function () {
    var inserted = pdfSource(end, "insertPage-new-source", numberedPdf(end, 2));
    var bytes = end
      .newRecipe()
      .createPage(400, 400)
      .endPage()
      .insertPage(1, inserted, 2)
      .insertPage(0, inserted, 1)
      .endPDF();
    writeOutput(end, "insertPage-new", bytes);
    assert.deepEqual(mediaBoxes(end, bytes), [
      [0, 0, 101, 201],
      [0, 0, 400, 400],
      [0, 0, 102, 202],
    ]);
  });

  it("keeps the PDF version of the document", function () {
    var created = end
      .newRecipe({ version: 2.0 })
      .createPage(100, 100)
      .endPage()
      .insertPage(1, end.pdf(TEST_PDF), 1)
      .endPDF();
    var edited = end
      .openRecipe("recipe/test2.pdf")
      .insertPage(1, end.pdf(TEST_PDF), 1)
      .endPDF();
    assert.deepEqual(
      [created, edited].map((bytes) =>
        new TextDecoder("latin1").decode(bytes.subarray(0, 8)),
      ),
      ["%PDF-2.0", "%PDF-1.3"],
    );
  });

  it("writes an encrypted source unencrypted unless encrypt() is called", function () {
    // the pages are copied into a new PDF, which cannot reproduce the source's
    // encryption without its owner password
    var ownerOnly = end
      .newRecipe({ ownerPassword: "own" })
      .createPage(100, 100)
      .endPage()
      .endPDF();
    var plain = end
      .openRecipe(ownerOnly)
      .insertPage(1, end.pdf(TEST_PDF), 1)
      .endPDF();
    writeOutput(end, "insertPage-encrypted-source", plain);
    assert.deepEqual(encryption(end, plain), { encrypted: false, pages: 2 });
    var encrypted = end
      .openRecipe(ownerOnly)
      .insertPage(1, end.pdf(TEST_PDF), 1)
      .encrypt({ userPassword: "u" })
      .endPDF();
    writeOutput(end, "insertPage-encrypted-source-encrypt", encrypted);
    assert.equal(opens(end, encrypted), false);
    assert.equal(encryption(end, encrypted, "u").encrypted, true);
    assert.equal(encryption(end, encrypted, "u").pages, 2);
  });

  it("rejects incomplete or invalid arguments", function () {
    var recipe = end.openRecipe(numberedPdf(end, 2));
    var wasm = end.name === "wasm";
    // Wasm checks a source and page at the call, with its own message.
    var missing = wasm
      ? "insertPage requires a registered PDF and one-based source page"
      : "insertPage requires pdfSrc and srcPageNumber";
    assert.throws(() => recipe.insertPage(0), {
      name: "TypeError",
      message: missing,
    });
    assert.throws(() => recipe.insertPage("after", end.pdf(TEST_PDF), 1), {
      name: "Error",
      message: "The afterPageNumber is inValid.",
    });
    if (wasm) {
      assert.throws(() => recipe.insertPage(1, "nope", 1), {
        name: "TypeError",
        message: missing,
      });
      assert.throws(() => recipe.insertPage(-1, end.pdf(TEST_PDF), 1), {
        name: "Error",
        message: "The afterPageNumber is inValid.",
      });
    }
    // Nothing was queued, so the PDF ends unchanged.
    assert.deepEqual(pageWidths(end, recipe.endPDF()), [101, 102]);
  });
});
