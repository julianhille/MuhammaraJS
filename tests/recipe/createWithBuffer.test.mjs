import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeEnds, fixture, writeOutput } from "../support/ends.mjs";
import { annotations, info } from "../support/pdf.mjs";
import { imagePlacements } from "../support/images.mjs";

describeEnds("Recipe from PDF bytes", function (end) {
  it("edits a PDF given as bytes and returns the bytes", function () {
    var myCats = end.image("recipe/myCats.jpg");
    var bytes = end
      .openRecipe(readFileSync(fixture("recipe/test.pdf")))
      .editPage(1)
      .image(myCats, "center", "center", {
        width: 300,
        height: 300,
        keepAspectRatio: false,
        opacity: 0.4,
        align: "center center",
      })
      .annot("center", "center", "Square", {
        text: "yo, I am a square",
        width: 200,
        height: 100,
        border: 10,
        color: [128, 31, 80],
      })
      .endPage()
      .endPDF();
    assert.ok(bytes instanceof Uint8Array);
    writeOutput(end, "createWithBuffer-edit", bytes);
    assert.deepEqual(imagePlacements(end, bytes), [
      {
        kind: "image",
        corners: [
          [156, 246],
          [456, 246],
          [456, 546],
          [156, 546],
        ],
        opacity: 0.4,
      },
    ]);
    var square = annotations(end, bytes).find(
      (annot) => annot.Subtype === "Square",
    );
    assert.equal(square.Contents, "yo, I am a square");
    assert.deepEqual(square.Rect, [306, 296, 506, 396]);
  });

  it("writes the info of a new PDF", function () {
    var bytes = end
      .newRecipe({
        version: 1.6,
        author: "John Doe",
        title: "Muhammara-Recipe",
        subject: "A brand new PDF",
      })
      .createPage("letter")
      .endPage()
      .endPDF();
    writeOutput(end, "createWithBuffer-new", bytes);
    assert.equal(Buffer.from(bytes.subarray(0, 8)).toString(), "%PDF-1.6");
    var entries = info(end, bytes);
    assert.equal(entries.Author, "John Doe");
    assert.equal(entries.Title, "Muhammara-Recipe");
    assert.equal(entries.Subject, "A brand new PDF");
  });

  it("reads another PDF instead of the source", function () {
    var other = end.pdf("BasicTIFFImagesTest.PDF");
    var recipe = end.openRecipe("Original.pdf");
    var ownPages = recipe.read().pages;
    assert.notEqual(recipe.read(other).pages, ownPages);
    assert.equal(
      recipe.read(readFileSync(fixture("BasicTIFFImagesTest.PDF"))).pages,
      recipe.read(other).pages,
    );
    // Reading another PDF leaves the Recipe's own source in place.
    assert.equal(recipe.metadata.pages, ownPages);
    recipe.endPDF();
  });
});
