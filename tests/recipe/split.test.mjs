// split() hands its pages over the way each end hands over files: native
// writes them into a directory, Wasm returns them (see the end-specific
// suites). Which pages end up in the split, and what they hold, is the same.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeEnds, fixture } from "../support/ends.mjs";
import { annotations, drawnContent, pageCount } from "../support/pdf.mjs";
import {
  numberedPdf,
  pageContents,
  pageWidths,
  splitRecipe,
  squareSizes,
} from "../support/composition.mjs";

var LONG_PDF = "recipe/compressed.tracemonkey-pldi-09.pdf";

describeEnds("Recipe split", function (end) {
  it("splits every page into its own PDF, in page order", function () {
    var parts = splitRecipe(
      end,
      end.openRecipe(numberedPdf(end, 3)),
      "split-numbered",
    );
    assert.deepEqual(
      parts.map((part) => part.name),
      ["split-numbered-1.pdf", "split-numbered-2.pdf", "split-numbered-3.pdf"],
    );
    assert.deepEqual(
      parts.map((part) => pageCount(end, part.bytes)),
      [1, 1, 1],
    );
    assert.deepEqual(
      parts.map((part) => pageWidths(end, part.bytes)[0]),
      [101, 102, 103],
    );
    assert.deepEqual(
      parts.map((part) => squareSizes(end, part.bytes)[0]),
      [1, 2, 3],
    );
  });

  it("copies each page's content unchanged", function () {
    var parts = splitRecipe(end, end.openRecipe(LONG_PDF), "split-long");
    var pages = pageContents(end, readFileSync(fixture(LONG_PDF)));
    assert.equal(parts.length, 14);
    parts.forEach((part, index) =>
      assert.deepEqual(pageContents(end, part.bytes), [pages[index]]),
    );
  });

  it("keeps the annotations of split pages", function () {
    var source = end
      .newRecipe()
      .createPage(100, 100)
      .comment("first page", 10, 10)
      .endPage()
      .createPage(100, 100)
      .endPage()
      .endPDF();
    var parts = splitRecipe(end, end.openRecipe(source), "split-annotated");
    assert.equal(annotations(end, parts[0].bytes)[0]?.Contents, "first page");
    assert.deepEqual(annotations(end, parts[1].bytes), []);
  });

  it("splits the document as the Recipe edited it", function () {
    var source = end
      .newRecipe()
      .createPage(100, 100)
      .endPage()
      .createPage(100, 100)
      .endPage()
      .endPDF();
    var recipe = end
      .openRecipe(source)
      .editPage(1)
      .text("edited", 10, 10, { font: "arial" })
      .endPage();
    var parts = splitRecipe(end, recipe, "split-edited");
    assert.equal(parts.length, 2);
    assert.match(drawnContent(end, parts[0].bytes), /Tj|TJ/);
    assert.doesNotMatch(drawnContent(end, parts[1].bytes), /Tj|TJ/);
  });
});
