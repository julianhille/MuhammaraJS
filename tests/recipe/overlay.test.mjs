import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeEnds, fixture, writeOutput } from "../support/ends.mjs";
import { drawnContent, pageContent } from "../support/pdf.mjs";
import { pdfSource, placedXObjectMatrices } from "../support/composition.mjs";

// Page sizes: test2.pdf page 1 is 612 x 792 and page 2 842 x 595, test3.pdf
// page 1 is 612 x 792, and issue-28-input.pdf is one 7900 x 2600 page.
var TEST2 = "recipe/test2.pdf";
var TEST3 = "recipe/test3.pdf";
var ISSUE_28 = "recipe/issue-28-input.pdf";

/**
 * Assert that a page places a form with the given matrix.
 * @param {number[][]} matrices - The matrices the page places forms with.
 * @param {number[]} expected - The expected `cm` operands.
 * @returns {void}
 */
function assertPlaced(matrices, expected) {
  var found = matrices.some((matrix) =>
    matrix.every((value, index) => Math.abs(value - expected[index]) < 1e-3),
  );
  assert.ok(
    found,
    `expected a form placed at [${expected}], found ${JSON.stringify(matrices)}`,
  );
}

// issue #28: position, scale and fit options of overlay().
var CASES = [
  {
    title: "overlays the first page at the top left",
    src: TEST2,
    overlay: TEST3,
    args: [],
    matrix: [1, 0, 0, 1, 0, 0],
  },
  {
    title: "positions the overlay from the top left",
    src: ISSUE_28,
    overlay: TEST2,
    args: [500, 300, {}],
    matrix: [1, 0, 0, 1, 500, 2600 - 792 - 300],
  },
  {
    title: "scales the overlay",
    src: ISSUE_28,
    overlay: TEST2,
    args: [{ keepAspectRatio: true, scale: 3 }],
    matrix: [3, 0, 0, 3, 0, 2600 - 3 * 792],
  },
  {
    title: "fits the overlay to the page width",
    src: ISSUE_28,
    overlay: TEST2,
    args: [{ keepAspectRatio: true, fitWidth: true }],
    matrix: [7900 / 612, 0, 0, 7900 / 612, 0, 2600 - (792 * 7900) / 612],
  },
  {
    title: "fits the overlay to the page height",
    src: ISSUE_28,
    overlay: TEST2,
    args: [{ keepAspectRatio: true, fitHeight: true }],
    matrix: [2600 / 792, 0, 0, 2600 / 792, 0, 0],
  },
  {
    title: "stretches the overlay to the page",
    src: ISSUE_28,
    overlay: TEST2,
    args: [{ fitHeight: true, fitWidth: true }],
    matrix: [7900 / 612, 0, 0, 2600 / 792, 0, 0],
  },
  {
    title: "overlays a selected page",
    src: TEST2,
    overlay: TEST3,
    args: [{ page: 1 }],
    matrix: [1, 0, 0, 1, 0, 0],
  },
  {
    title: "positions a selected page",
    src: ISSUE_28,
    overlay: TEST2,
    args: [500, 300, { page: 1 }],
    matrix: [1, 0, 0, 1, 500, 2600 - 792 - 300],
  },
  {
    title: "scales a selected page",
    src: ISSUE_28,
    overlay: TEST2,
    args: [{ keepAspectRatio: true, scale: 3, page: 2 }],
    matrix: [3, 0, 0, 3, 0, 2600 - 3 * 595],
  },
  {
    title: "fits a selected page to the page width",
    src: ISSUE_28,
    overlay: TEST2,
    args: [{ keepAspectRatio: true, fitWidth: true, page: 2 }],
    matrix: [7900 / 842, 0, 0, 7900 / 842, 0, 2600 - (595 * 7900) / 842],
  },
  {
    title: "fits a selected page to the page height",
    src: ISSUE_28,
    overlay: TEST2,
    args: [{ keepAspectRatio: true, fitHeight: true, page: 1 }],
    matrix: [2600 / 792, 0, 0, 2600 / 792, 0, 0],
  },
  {
    title: "stretches a selected page to the page",
    src: ISSUE_28,
    overlay: TEST2,
    args: [{ fitHeight: true, fitWidth: true, page: 2 }],
    matrix: [7900 / 842, 0, 0, 2600 / 595, 0, 0],
  },
];

describeEnds("Recipe overlay", function (end) {
  CASES.forEach((testCase, index) => {
    it(testCase.title, function () {
      var bytes = end
        .openRecipe(testCase.src)
        .editPage(1)
        .overlay(end.pdf(testCase.overlay), ...testCase.args)
        .endPage()
        .endPDF();
      writeOutput(end, `overlay-${index + 1}`, bytes);
      assertPlaced(placedXObjectMatrices(end, bytes), testCase.matrix);
      // The overlaid page's own content is drawn on the edited page.
      var page = testCase.args.find((arg) => arg?.page)?.page || 1;
      var overlaid = pageContent(
        end,
        readFileSync(fixture(testCase.overlay)),
        page - 1,
      );
      if (overlaid) assert.ok(drawnContent(end, bytes).includes(overlaid));
    });
  });

  it("overlays pages of a produced PDF on a created page", function () {
    var source = pdfSource(
      end,
      "overlay-produced-source",
      end
        .newRecipe()
        .createPage(595, 842)
        .rectangle(10, 10, 7, 7, { fill: "#000000" })
        .endPage()
        .createPage(300, 200)
        .rectangle(10, 10, 9, 9, { fill: "#000000" })
        .endPage()
        .endPDF(),
    );
    var bytes = end
      .newRecipe()
      .createPage(595, 842)
      .overlay(source)
      .overlay(source, 20, 20, {
        page: 2,
        scale: 0.5,
        fitHeight: true,
        keepAspectRatio: false,
      })
      .endPage()
      .endPDF();
    writeOutput(end, "overlay-produced", bytes);
    var matrices = placedXObjectMatrices(end, bytes);
    assertPlaced(matrices, [1, 0, 0, 1, 0, 0]);
    // fitHeight without keepAspectRatio scales only y; scale applies to x.
    assertPlaced(matrices, [0.5, 0, 0, 842 / 200, 20, 842 - 842 - 20]);
    var content = drawnContent(end, bytes);
    assert.match(content, /\b7 7 re\b/);
    assert.match(content, /\b9 9 re\b/);
  });

  it("selects the first page for a page beyond the overlay PDF", function () {
    var bytes = end
      .openRecipe(ISSUE_28)
      .editPage(1)
      .overlay(end.pdf(TEST2), { page: 5 })
      .endPage()
      .endPDF();
    writeOutput(end, "overlay-page-beyond", bytes);
    assertPlaced(placedXObjectMatrices(end, bytes), [
      1,
      0,
      0,
      1,
      0,
      2600 - 792,
    ]);
  });
});
