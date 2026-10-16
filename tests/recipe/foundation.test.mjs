import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import {
  annotations,
  drawnContent,
  info,
  pageCount,
  withReader,
  pageFields,
} from "../support/pdf.mjs";
import { imagePlacements, pageGeometry } from "../support/images.mjs";

describeEnds("Recipe foundation", function (end) {
  it("exposes the Recipe value constants as frozen statics", function () {
    var Recipe = end.Recipe;
    for (var name of [
      "TextWrap",
      "TextAlign",
      "TableRowNth",
      "LineCap",
      "LineJoin",
      "ArrowAt",
      "ArrowType",
      "TriangleTrait",
      "TrianglePosition",
      "PageLayout",
      "PageSize",
      "HorizontalAlign",
      "VerticalAlign",
      "FontStyle",
      "Permission",
      "Coordinate",
      "Colorspace",
      "AnnotSubtype",
      "AnnotFlag",
      "ChromaCommand",
      "AnnotIcon",
      "PdfA",
    ]) {
      assert.ok(Object.isFrozen(Recipe[name]), name);
    }
    assert.equal(Recipe.TextWrap.ELLIPSIS, "ellipsis");
    assert.equal(Recipe.AnnotFlag.LOCKED_CONTENTS, "lockedcontents");
    assert.equal(Recipe.PageSize.A4, "a4");
    assert.equal(Recipe.ChromaCommand.LOAD, "!load");
    assert.deepEqual(Object.values(Recipe.FontStyle), [
      "regular",
      "bold",
      "italic",
      "bold-italic",
    ]);
  });

  it("uses Letter defaults, incremental margins, and named page sizes", function () {
    var recipe = end.newRecipe().createPage();
    assert.deepEqual(pageFields(recipe.pageInfo(1)), {
      width: 612,
      height: 792,
      rotate: 0,
      pageNumber: 1,
    });
    assert.deepEqual(recipe.margins(), {
      left: 72,
      right: 72,
      top: 72,
      bottom: 72,
    });
    recipe.margins({ left: 36 });
    assert.deepEqual(recipe.margins(), {
      left: 36,
      right: 72,
      top: 72,
      bottom: 72,
    });
    assert.deepEqual(recipe.position, { x: 0, y: 0 });
    recipe.endPage().createPage("a4", 90).endPage();
    // A rotation given with a named size turns the page into landscape.
    assert.equal(recipe.pageInfo(2).width, 841.89);
    assert.equal(recipe.pageInfo(2).height, 595.28);
    var bytes = recipe.endPDF();
    writeOutput(end, "foundation-letter-defaults", bytes);
    assert.deepEqual(pageGeometry(end, bytes, 0).media, [0, 0, 612, 792]);
    assert.deepEqual(pageGeometry(end, bytes, 1).media, [0, 0, 841.89, 595.28]);
  });

  it("writes page boxes and places center coordinates on the moved media box", function () {
    var M = end.muhammara;
    var recipe = end
      .newRecipe({ compress: false })
      .createPage(200, 300)
      .setPageBox(M.ePDFPageBoxMediaBox, 10, 20, 210, 320)
      .setPageBox(M.ePDFPageBoxCropBox, 11, 21, 209, 319)
      .setPageBox(M.ePDFPageBoxBleedBox, 12, 22, 208, 318)
      .setPageBox(M.ePDFPageBoxTrimBox, 13, 23, 207, 317)
      .setPageBox(M.ePDFPageBoxArtBox, 14, 24, 206, 316);
    assert.deepEqual(pageFields(recipe.pageInfo(1)), {
      width: 200,
      height: 300,
      rotate: 0,
      pageNumber: 1,
    });
    var centered = recipe.moveTo("center", "center").position;
    var bytes = recipe
      .rectangle("center", "center", 20, 10, { fill: "#000000" })
      .endPage()
      .endPDF();
    writeOutput(end, "foundation-page-boxes", bytes);
    assert.deepEqual(pageGeometry(end, bytes), {
      media: [10, 20, 210, 320],
      crop: [11, 21, 209, 319],
      bleed: [12, 22, 208, 318],
      trim: [13, 23, 207, 317],
      art: [14, 24, 206, 316],
      rotate: 0,
    });
    assert.deepEqual(
      imagePlacements(end, bytes).map((placement) => placement.corners),
      [
        [
          [110, 160],
          [130, 160],
          [130, 170],
          [110, 170],
        ],
      ],
    );
    // The page center is 110, 170 in PDF coordinates; position reports it
    // back in Recipe coordinates, from the top-left of the media box.
    assert.deepEqual(centered, { x: 100, y: 150 });
  });

  it("rejects unknown page boxes", function () {
    var recipe = end.newRecipe().createPage();
    assert.throws(() => recipe.setPageBox(5, 0, 0, 1, 1), {
      name: "RangeError",
      message: "Unknown page box: 5",
    });
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "foundation-unknown-page-box", bytes);
    assert.deepEqual(pageGeometry(end, bytes).crop, [0, 0, 612, 792]);
  });

  it("writes canonical versions and the Recipe producer, and finishes once", function () {
    var recipe = end
      .newRecipe({ version: 2.0, compress: false })
      .createPage()
      .endPage();
    var callbackBytes;
    recipe.endPDF((result) => {
      callbackBytes = result;
    });
    writeOutput(end, "foundation-version-callback", callbackBytes);
    assert.ok(callbackBytes instanceof Uint8Array);
    // A later call does not finish the PDF again; it hands back the same bytes.
    assert.strictEqual(recipe.endPDF(), callbackBytes);
    assert.equal(
      withReader(end, callbackBytes, (reader) => reader.getPDFLevel()),
      2,
    );
    var entries = info(end, callbackBytes);
    assert.match(entries.CreationDate, /^D:/);
    assert.match(entries.ModDate, /^D:/);
    assert.match(entries.Producer, /^MuhammaraJS/);
    assert.match(entries.Creator, /^Muhammara-Recipe/);

    // Editing keeps the source's entries under a source- prefix.
    var modified = end.openRecipe(callbackBytes).editPage(1).endPage().endPDF();
    writeOutput(end, "foundation-version-callback-modified", modified);
    var modifiedEntries = info(end, modified);
    assert.match(modifiedEntries["source-ModDate"], /^D:/);
    assert.match(modifiedEntries["source-Creator"], /^Muhammara-Recipe/);
    assert.match(modifiedEntries["source-Producer"], /^MuhammaraJS/);
  });

  it("reads PDF bytes and edits an existing page across paused contexts", function () {
    var source = end
      .newRecipe({ compress: false })
      .createPage(200, 300)
      .rectangle(10, 10, 20, 20, { fill: "#000000" })
      .endPage()
      .endPDF();
    writeOutput(end, "foundation-paused-edit-source", source);
    var reader = end.newRecipe();
    assert.equal(reader.read(source).pages, 1);
    // Reading other bytes does not turn a new Recipe into an editing one:
    // it has no page 1, which native reports with a TypeError and Wasm with
    // null, as each always has.
    if (end.name === "wasm") assert.equal(reader.pageInfo(1), null);
    else
      assert.throws(() => reader.pageInfo(1), {
        name: "TypeError",
        message: "Unknown page number: 1",
      });
    reader.endPDF();

    var recipe = end.openRecipe(source, { compress: false });
    assert.deepEqual(pageFields(recipe.pageInfo(1)), {
      width: 200,
      height: 300,
      rotate: 0,
      pageNumber: 1,
    });
    recipe.editPage(1).rectangle(30, 30, 20, 20, { fill: "#000000" });
    assert.throws(() => recipe.resumeContext(), /No paused page/);
    assert.equal(recipe.pauseContext(), recipe);
    assert.throws(() => recipe.pauseContext(), /No active page/);
    assert.equal(recipe.resumeContext(), recipe);
    assert.throws(() => recipe.resumeContext(), /No paused page/);
    recipe.rectangle(60, 60, 20, 20, { fill: "#000000" }).endPage();
    var bytes = recipe.endPDF();
    writeOutput(end, "foundation-paused-edit", bytes);
    assert.ok(bytes instanceof Uint8Array);
    assert.equal(pageCount(end, bytes), 1);
    // The original content stays, and both edit contexts are drawn after it.
    assert.deepEqual(
      imagePlacements(end, bytes).map((placement) => placement.corners[0]),
      [
        [10, 270],
        [30, 250],
        [60, 220],
      ],
    );
  });

  it("creates pages after reading a source PDF", function () {
    var source = end.newRecipe().createPage(200, 300).endPage().endPDF();
    writeOutput(end, "foundation-create-after-read-source", source);
    var recipe = end.openRecipe(source).createPage(400, 500);
    assert.deepEqual(recipe.position, { x: 0, y: 0 });
    recipe.endPage();
    assert.deepEqual(pageFields(recipe.pageInfo(2)), {
      width: 400,
      height: 500,
      rotate: 0,
      pageNumber: 2,
    });
    var bytes = recipe.endPDF();
    writeOutput(end, "foundation-create-after-read", bytes);
    assert.equal(pageCount(end, bytes), 2);
    assert.deepEqual(pageGeometry(end, bytes, 1).media, [0, 0, 400, 500]);
  });

  it("rejects invalid edit lifecycle calls", function () {
    var recipe = end.newRecipe();
    // The wording is each end's own, as it always was.
    assert.throws(() => recipe.editPage(1), {
      name: "Error",
      message:
        end.name === "wasm"
          ? "editPage requires a Recipe constructed from PDF bytes"
          : "editPage requires a Recipe constructed from an existing PDF",
    });
    assert.throws(() => recipe.pauseContext(), /No active page/);
    assert.throws(() => recipe.resumeContext(), /No paused page/);
    recipe.endPDF();
    var source = end.newRecipe().createPage().endPage().endPDF();
    writeOutput(end, "foundation-edit-lifecycle-source", source);
    recipe = end.openRecipe(source);
    // A page the source does not have throws, in each end's own words.
    assert.throws(() => recipe.editPage(2));
    recipe = end.openRecipe(source);
    recipe.editPage(1);
    assert.throws(() => recipe.editPage(1), {
      name: "Error",
      message: "Finish the current page before editing another page",
    });
    // endPDF() finishes the edited page itself.
    var bytes = recipe.endPDF();
    writeOutput(end, "foundation-edit-lifecycle", bytes);
    assert.equal(pageCount(end, bytes), 1);
  });

  it("rejects extension names inherited from Recipe.prototype", function () {
    var recipe = end.newRecipe();
    assert.throws(
      () => recipe.register("toString", function toString() {}),
      /already exists/,
    );
    recipe.endPDF();
  });

  it("links, places images and clips text on an edited page", function () {
    var logo = end.image("images/png/pnglogo-grr.png");
    var source = end
      .newRecipe({ compress: false })
      .createPage(200, 200)
      .endPage()
      .endPDF();
    writeOutput(end, "foundation-links-images-clip-source", source);
    var recipe = end.openRecipe(source, { compress: false });
    var html = recipe.htmlToTextObjects("<b>bold</b><br>text");
    // Meant to differ until a major release: native returns its nested
    // layout tree, Wasm its flat styled runs, as each always has.
    if (end.name === "wasm") {
      assert.deepEqual(
        html.map((part) => [part.value, Boolean(part.styles.bold)]),
        [
          ["bold", true],
          ["\n", false],
          ["text", false],
        ],
      );
    } else {
      // One object per child node: the bold element holds its text.
      assert.deepEqual(
        html.map((part) => [part.tag, part.isBold, part.lineBreak, part.value]),
        [
          ["b", true, false, null],
          ["br", false, true, null],
          [undefined, false, false, "text"],
        ],
      );
      assert.equal(html[0].childs[0].value, "bold");
    }
    var bytes = recipe
      .editPage(1)
      .link("https://example.test", 10, 10, 20, 10)
      .image(logo, 10, 30, { width: 20 })
      .text("this source text is clipped", 10, 60, {
        font: "arial",
        textBox: { width: 30, wrap: "clip" },
      })
      .endPage()
      .endPDF();
    writeOutput(end, "foundation-links-images-clip", bytes);
    var [link] = annotations(end, bytes);
    assert.equal(link.A.URI, "https://example.test");
    assert.deepEqual(link.Rect, [10, 180, 30, 190]);
    assert.deepEqual(
      imagePlacements(end, bytes).find(
        (placement) => placement.kind === "image",
      ).corners,
      [
        [10, 155],
        [30, 155],
        [30, 170],
        [10, 170],
      ],
    );
    // The text box clips its text to its 30 point width, from x 10 to 40.
    assert.match(
      drawnContent(end, bytes),
      /\b10 ([\d.]+) m\s+40 \1 l\s+40 ([\d.]+) l\s+10 \2 l\s+h\s+W\s+n/,
    );
  });
});
