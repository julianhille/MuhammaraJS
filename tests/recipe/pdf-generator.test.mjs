import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { drawnContent, info, textRuns } from "../support/pdf.mjs";
import { imagePlacements, pageGeometry } from "../support/images.mjs";

var PDF = {
  info: {
    version: 1.7,
    author: "someone",
    title: "No title",
    subject: "Blank PDF",
    keywords: ["hummus", "js", "is", "our", "friend"],
  },
  pages: [
    {
      width: 500,
      height: 700,
      background: {
        value: [25, 23, 255],
        opacity: 0.1,
      },
      waterMark: "MY WATERMARK",
      footer: true,
    },
    {
      width: 612,
      height: 792,
      background: {
        value: [255, 50, 155],
        opacity: 0.5,
      },
      waterMark: null,
      footer: true,
    },
  ],
};

describeEnds("Recipe PDF generator", function (end) {
  it("generates pages with a background, a watermark and a footer", function () {
    var recipe = end.newRecipe();
    recipe.info(PDF.info);
    PDF.pages.forEach((page, index) => {
      var { width, height } = page;
      recipe.createPage(width, height);
      if (page.background) {
        recipe.rectangle(0, 0, width, height, {
          fill: page.background.value,
          opacity: page.background.opacity || 0.1,
        });
      }
      if (page.waterMark) {
        recipe.text(page.waterMark, "center", "center", {
          font: "arial",
          bold: true,
          size: 50,
          color: "#0000ff",
          align: "center center",
          opacity: 0.3,
        });
      }
      if (page.footer) {
        recipe.text(`Page ${index + 1}`, "center", height - 30, {
          font: "arial",
          size: 10,
          color: "#000000",
          align: "center center",
        });
      }
      recipe.endPage();
    });
    var bytes = recipe.endPDF();
    writeOutput(end, "pdf-generator", bytes);

    var entries = info(end, bytes);
    assert.equal(entries.Author, "someone");
    assert.equal(entries.Title, "No title");
    assert.equal(entries.Subject, "Blank PDF");
    assert.equal(entries.Keywords, "hummus, js, is, our, friend");
    PDF.pages.forEach((page, index) => {
      assert.deepEqual(pageGeometry(end, bytes, index).media, [
        0,
        0,
        page.width,
        page.height,
      ]);
      // The background covers the page at its opacity.
      var [background] = imagePlacements(end, bytes, { pageIndex: index });
      assert.deepEqual(background.corners, [
        [0, 0],
        [page.width, 0],
        [page.width, page.height],
        [0, page.height],
      ]);
      assert.equal(background.opacity, page.background.opacity);
      assert.deepEqual(
        textRuns(end, bytes, index).map((run) => run.text),
        [`Page ${index + 1}`],
      );
      // A translucent watermark is drawn through a form, where text
      // extraction does not look.
      var content = drawnContent(end, bytes, index);
      assert.equal(
        content.includes("(MY WATERMARK) Tj"),
        Boolean(page.waterMark),
      );
    });
  });
});
