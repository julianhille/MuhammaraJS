import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeEnds, fixture, writeOutput } from "../support/ends.mjs";
import { annotations, pageCount } from "../support/pdf.mjs";
import {
  mediaBoxes,
  numberedPdf,
  pageContents,
  pageWidths,
  pdfSource,
} from "../support/composition.mjs";

var LONG_PDF = "recipe/compressed.tracemonkey-pldi-09.pdf";

describeEnds("Recipe appendPages", function (end) {
  it("appends single pages, page lists, ranges and whole PDFs", function () {
    var long = end.pdf(LONG_PDF);
    var bytes = end
      .openRecipe("recipe/test.pdf")
      .appendPage(long, 10)
      .appendPage(long, [4, 6])
      .appendPage(long, [
        [1, 3],
        [6, 20],
      ])
      .appendPage(long)
      .endPDF();
    writeOutput(end, "appendPages-selections", bytes);

    // test.pdf is 14 pages; the long PDF's pages are told apart by content,
    // and the range end beyond its 14 pages is clamped to the last one.
    var longPages = pageContents(end, readFileSync(fixture(LONG_PDF)));
    var appended = [10, 4, 6, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14].concat(
      Array.from({ length: 14 }, (_, index) => index + 1),
    );
    var contents = pageContents(end, bytes);
    assert.equal(contents.length, 14 + appended.length);
    appended.forEach((pageNumber, index) =>
      assert.equal(
        contents[14 + index],
        longPages[pageNumber - 1],
        `appended page ${index + 1} is page ${pageNumber}`,
      ),
    );
  });

  it("appends every page, or a selected page, to a new PDF", function () {
    var source = pdfSource(
      end,
      "appendPages-two-page-source",
      numberedPdf(end, 2),
    );
    var all = end.newRecipe().appendPage(source).endPDF();
    writeOutput(end, "appendPages-all", all);
    assert.deepEqual(pageWidths(end, all), [101, 102]);

    var selected = end.newRecipe().appendPage(source, 2).endPDF();
    writeOutput(end, "appendPages-selected", selected);
    assert.deepEqual(pageWidths(end, selected), [102]);
  });

  it("keeps the annotations of appended pages", function () {
    var source = end
      .newRecipe({ compress: false })
      .createPage(100, 100)
      .comment("source annotation", 10, 10, { width: 20, height: 20 })
      .endPage()
      .endPDF();
    var bytes = end
      .newRecipe({ compress: false })
      .appendPage(pdfSource(end, "appendPages-annotated-source", source))
      .endPDF();
    writeOutput(end, "appendPages-annotated", bytes);
    var [annotation] = annotations(end, bytes);
    assert.equal(annotations(end, bytes).length, 1);
    assert.equal(annotation.Subtype, "Text");
    assert.equal(annotation.Contents, "source annotation");
  });

  it("appends pages after the pages of a source PDF", function () {
    var appended = pdfSource(
      end,
      "appendPages-square-source",
      end.newRecipe().createPage(300, 300).endPage().endPDF(),
    );
    var recipe = end.openRecipe(numberedPdf(end, 2)).appendPage(appended);
    var bytes = recipe.endPDF();
    writeOutput(end, "appendPages-after-source", bytes);
    assert.deepEqual(mediaBoxes(end, bytes), [
      [0, 0, 101, 201],
      [0, 0, 102, 202],
      [0, 0, 300, 300],
    ]);
  });

  it("reports appended pages in the Recipe metadata", function () {
    var appended = pdfSource(
      end,
      "appendPages-metadata-source",
      end.newRecipe().createPage(300, 300).endPage().endPDF(),
    );
    var recipe = end.openRecipe(numberedPdf(end, 2)).appendPage(appended);
    assert.deepEqual(recipe.metadata[3]?.mediaBox, [0, 0, 300, 300]);
    assert.deepEqual(
      {
        width: recipe.pageInfo(3).width,
        height: recipe.pageInfo(3).height,
      },
      { width: 300, height: 300 },
    );
    assert.equal(pageCount(end, recipe.endPDF()), 3);
  });

  it("keeps annotations of a page created after appended pages on that page", function () {
    var appended = pdfSource(
      end,
      "appendPages-before-created-source",
      end.newRecipe().createPage(300, 300).endPage().endPDF(),
    );
    var bytes = end
      .openRecipe(numberedPdf(end, 2))
      .appendPage(appended)
      .createPage(400, 400)
      .comment("created", 10, 10)
      .endPage()
      .endPDF();
    writeOutput(end, "appendPages-before-created", bytes);
    assert.deepEqual(mediaBoxes(end, bytes)[3], [0, 0, 400, 400]);
    assert.deepEqual(annotations(end, bytes, 2), []);
    assert.equal(annotations(end, bytes, 3)[0]?.Contents, "created");
  });

  it("takes the bytes of another PDF for appendPage, insertPage and overlay", function () {
    var other = end.newRecipe().createPage(300, 300).endPage().endPDF();
    var bytes = end
      .newRecipe()
      .createPage(400, 400)
      .overlay(other)
      .endPage()
      .appendPage(other)
      .insertPage(0, other, 1)
      .endPDF();
    writeOutput(end, "appendPages-byte-sources", bytes);
    assert.deepEqual(pageWidths(end, bytes), [300, 400, 300]);
  });

  it("throws each end's reader error for a source that is no PDF", function () {
    var garbage = pdfSource(
      end,
      "appendPages-garbage",
      new Uint8Array([1, 2, 3, 4]),
    );
    var readerError =
      end.name === "native"
        ? { name: "TypeError", message: "Unable to start parsing PDF file" }
        : { name: "Error", message: "Unable to parse PDF" };
    assert.throws(
      () => end.newRecipe().createPage(100, 100).appendPage(garbage),
      readerError,
    );
    assert.throws(
      () => end.newRecipe().read(garbage),
      end.name === "native"
        ? { name: "Error", message: "TypeError: " + readerError.message }
        : readerError,
    );
    // A source that needs a password: the reader's message, which native
    // throws as the TypeError appendPage() has always thrown.
    assert.throws(
      () =>
        end
          .newRecipe()
          .createPage(100, 100)
          .endPage()
          .appendPage(end.pdf("PDFWithPassword.PDF")),
      end.name === "native"
        ? {
            name: "TypeError",
            message: "HummusJS: Unable to read/edit PDF file (pages=0)",
          }
        : { name: "Error", message: "Unable to read/edit PDF file (pages=0)" },
    );
  });
});
