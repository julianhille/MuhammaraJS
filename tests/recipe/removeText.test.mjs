import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { pageContent, textRuns } from "../support/pdf.mjs";
import { formContent, lowLevelPdf } from "../support/tables.mjs";

/**
 * A page with a red square and the text "Visible" in Arial, followed by
 * optional free content-stream code.
 * @param {object} end - The end.
 * @param {string} [freeCode] - Content appended after the text.
 * @returns {Uint8Array} The source PDF.
 */
function source(end, freeCode) {
  return lowLevelPdf(end, 200, 200, (context, font) => {
    context
      .q()
      .rg(1, 0, 0)
      .re(10, 10, 50, 50)
      .f()
      .Q()
      .BT()
      .Tf(font("arial.ttf"), 12)
      .Tm(1, 0, 0, 1, 20, 30)
      .Tj("Visible")
      .ET();
    if (freeCode) context.writeFreeCode(freeCode);
  });
}

/**
 * The source with "Added" written into page 1 through editPage(), which
 * draws it in a form XObject.
 * @param {object} end - The end.
 * @returns {Uint8Array} The edited PDF.
 */
function edited(end) {
  return end
    .openRecipe(source(end))
    .editPage(1)
    .text("Added", 50, 50, { font: "arial" })
    .endPage()
    .endPDF();
}

describeEnds("Recipe removeText", function (end) {
  it("removes every text-showing operator and keeps graphics", function () {
    var input = source(
      end,
      [
        "% comment with (Tj) inside",
        "/Span <</ActualText (a\\)b) /MCID 0>> BDC",
        "BT 20 60 Td 14 TL [(Kern) -250 <00410042> (ed\\) \\(x)] TJ",
        "(Next line) ' 2 1 (Spaced) \" ET EMC",
        "q 2 0 0 2 0 0 cm BI /W 1 /H 1 /CS /G /BPC 8 ID \xe9Tj\xff EI Q",
        "0 0 1 rg 100 100 20 20 re f",
      ].join("\n"),
    );
    writeOutput(end, "removeText-operators-source", input);
    assert.ok(textRuns(end, input).length > 0);

    var output = end.openRecipe(input).removeText(1).endPDF();
    writeOutput(end, "removeText-operators", output);

    assert.deepEqual(textRuns(end, output), []);
    var content = pageContent(end, output);
    assert.doesNotMatch(
      content.replace(/ID [^]*? EI/, "").replace(/%.*/, ""),
      /\bTj\b|\bTJ\b|'|"/,
    );
    assert.ok(content.includes("10 10 50 50 re"));
    assert.ok(content.includes("100 100 20 20 re f"));
    assert.ok(content.includes("<</ActualText (a\\)b) /MCID 0>> BDC"));
    // Inline image data is copied byte for byte, even where it reads as Tj.
    assert.ok(
      content.includes(
        "ID " + Buffer.from("\xe9Tj\xff").toString("latin1") + " EI",
      ),
    );
    assert.match(content, /14 TL\s+T\*\s+2 Tw 1 Tc T\*\s+ET/);
  });

  it('drops a malformed " operator instead of writing undefined', function () {
    var output = end
      .openRecipe(source(end, 'BT (one) " 2 (two) " 3 1 (three) " ET'))
      .removeText(1)
      .endPDF();
    writeOutput(end, "removeText-malformed-quote", output);

    var content = pageContent(end, output);
    assert.ok(!content.includes("undefined"));
    assert.ok(!content.includes("(two) Tc"));
    assert.match(content, /BT\s+3 Tw 1 Tc T\*\s+ET/);
  });

  it("removes text from painted Form XObjects when forms is set", function () {
    var input = edited(end);
    writeOutput(end, "removeText-forms-edited", input);
    assert.match(formContent(end, input), /\bTj\b/);

    var pageOnly = end.openRecipe(input).removeText(1).endPDF();
    writeOutput(end, "removeText-forms-page-only", pageOnly);
    assert.deepEqual(textRuns(end, pageOnly), []);
    assert.match(formContent(end, pageOnly), /\bTj\b/);

    var output = end.openRecipe(input).removeText(1, { forms: true }).endPDF();
    writeOutput(end, "removeText-forms", output);
    assert.deepEqual(textRuns(end, output), []);
    var content = pageContent(end, output);
    assert.ok(content.includes("10 10 50 50 re"));
    assert.ok(content.includes("/_0 Do"));
    assert.doesNotMatch(formContent(end, output), /\bTj\b/);
    assert.match(formContent(end, output), /\bTf\b/);

    var twice = end
      .openRecipe(input)
      .removeText(1, { forms: true })
      .removeText(1, { forms: true })
      .endPDF();
    writeOutput(end, "removeText-forms-twice", twice);
    // The second pass rewrites the objects of the first instead of adding
    // duplicates to the incremental update.
    var text = Buffer.from(twice).toString("latin1");
    var update = text.slice(text.lastIndexOf("%%EOF", text.length - 8));
    var objectIds = update.match(/^\d+(?= 0 obj)/gm);
    assert.equal(new Set(objectIds).size, objectIds.length);
    assert.deepEqual(textRuns(end, twice), []);
  });

  it("keeps text added with editPage in either order", function () {
    var removedFirst = end
      .openRecipe(source(end))
      .removeText(1)
      .editPage(1)
      .text("OCR", 20, 30, { font: "arial" })
      .endPage()
      .endPDF();
    writeOutput(end, "removeText-ocr-remove-then-edit", removedFirst);
    assert.ok(!pageContent(end, removedFirst).includes("Visible"));
    assert.match(formContent(end, removedFirst), /\bTj\b/);

    var editedFirst = end
      .openRecipe(source(end))
      .editPage(1)
      .text("OCR", 20, 30, { font: "arial" })
      .endPage()
      .removeText(1)
      .endPDF();
    writeOutput(end, "removeText-ocr-edit-then-remove", editedFirst);
    assert.ok(!pageContent(end, editedFirst).includes("Visible"));
    assert.match(formContent(end, editedFirst), /\bTj\b/);
  });

  it("removes text on a page whose page tree has a /Parent cycle", function () {
    var output = end
      .openRecipe("FontMalformed.pdf")
      .removeText(1, { forms: true })
      .endPDF();
    writeOutput(end, "removeText-cycle", output);
    assert.deepEqual(textRuns(end, output), []);
  });

  it("validates the page number", function () {
    var recipe = end.openRecipe(source(end));

    assert.throws(() => recipe.removeText(), {
      name: "TypeError",
      message: "removeText expects a positive integer page number",
    });
    assert.throws(() => recipe.removeText(0), {
      name: "TypeError",
      message: "removeText expects a positive integer page number",
    });
    assert.throws(() => recipe.removeText(1, true), {
      name: "TypeError",
      message: "removeText expects an options object",
    });
    assert.throws(() => recipe.removeText(2), {
      name: "RangeError",
      message: "removeText page 2 does not exist",
    });
    writeOutput(end, "removeText-validation", recipe.endPDF());
  });
});
