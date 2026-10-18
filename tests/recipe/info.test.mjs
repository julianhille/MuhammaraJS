import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { annotations, info, pageCount, textRuns } from "../support/pdf.mjs";

// A PDF date as Recipe writes it, without its volatile value.
var PDF_DATE = /^D:\d{14}(Z|[+-]\d{2}'\d{2}')$/;

/**
 * Pick some keys of an object.
 * @param {object} object - The object.
 * @param {string[]} keys - The keys to keep.
 * @returns {object} The picked entries that exist.
 */
function pick(object, keys) {
  return Object.fromEntries(
    keys.filter((key) => key in object).map((key) => [key, object[key]]),
  );
}

describeEnds("Recipe info", function (end) {
  it("escapes XML characters in the XMP packet", function () {
    var recipe = end.newRecipe({ xmp: true, title: "Tom & <Jerry>" });
    var bytes = recipe.createPage(100, 100).endPage().endPDF();
    assert.match(
      Buffer.from(bytes).toString("latin1"),
      /Tom &amp; &lt;Jerry&gt;/,
    );
  });

  // Each end returns for a new PDF what it always has.
  it("returns the Info of a new PDF from getPageInfo()", function () {
    var recipe = end.newRecipe({ title: "T" });
    var info = recipe.getPageInfo();
    if (end.name === "wasm") {
      assert.equal(JSON.stringify(info), '{"title":"T"}');
    } else {
      assert.equal(typeof info.addAdditionalInfoEntry, "function");
    }
    recipe.endPDF();
  });

  it("writes the Info of an edited source, which a new Recipe reads back", function () {
    var bytes = end
      .openRecipe("recipe/blank.pdf")
      .info({ author: "yo man", title: "Hello World" })
      .custom("some", "thing?")
      .editPage(1)
      .comment("Feel free to open issues to help us!", "center", 100, {
        flag: "locked",
      })
      .endPage()
      .endPDF();
    writeOutput(end, "info-change", bytes);
    var read = end.openRecipe(bytes).info();
    assert.equal(read.title, "Hello World");
    assert.equal(read.author, "yo man");
    assert.equal(read.some, "thing?");
    assert.match(read.creator, /^Muhammara-Recipe/);
    assert.match(read.producer, /^MuhammaraJS/);
    assert.match(read.modDate, PDF_DATE);
  });

  it("keeps the source entries of an Info written with indirect objects", function () {
    var bytes = end
      .openRecipe("recipe/test-info.pdf")
      .info({ author: "Me" })
      .endPDF();
    writeOutput(end, "info-indirect", bytes);
    var { ModDate, ...entries } = info(end, bytes);
    assert.match(ModDate, PDF_DATE);
    assert.deepEqual(entries, {
      Author: "Me",
      CreationDate: "D:20171115190541Z",
      Creator: "Muhammara-Recipe (https://github.com/julianhille/MuhammaraJS)",
      Producer: "MuhammaraJS (https://github.com/julianhille/MuhammaraJS)",
      Title: "Document2",
      "source-Creator": "Word",
      "source-ModDate": "D:20180208092726-08'00'",
      "source-Producer": "Mac OS X 10.11.6 Quartz PDFContext",
    });
  });

  it("keeps the source Trapped entry when saving", function () {
    var bytes = end.openRecipe("Linearized.pdf").endPDF();
    writeOutput(end, "info-keep-trapped", bytes);
    var entries = info(end, bytes);
    assert.equal(entries.Trapped, "False");
    assert.ok(entries.CreationDate);
  });

  [
    ["True", "True"],
    ["False", "False"],
    // PDFWriter omits /Trapped when it is Unknown, the PDF default.
    ["Unknown", undefined],
  ].forEach(([source, expected]) => {
    it(`keeps the source Trapped ${source} entry when saving`, function () {
      var bytes = end.openRecipe(`Trapped${source}.pdf`).endPDF();
      writeOutput(end, `info-keep-trapped-${source}`, bytes);
      var entries = info(end, bytes);
      assert.equal(entries.Trapped, expected);
      assert.equal(entries.CreationDate, "D:20200102030405+00'00'");
      assert.equal(entries.Title, `Trapped ${source}`);
      assert.equal(entries.Author, "Source Author");
      assert.equal(entries.Subject, "Source Subject");
      assert.equal(entries.Keywords, "source, keywords");
    });
  });

  it("lets info() override the source Title when saving", function () {
    var bytes = end
      .openRecipe("TrappedTrue.pdf")
      .info({ title: "override" })
      .endPDF();
    writeOutput(end, "info-override-source-title", bytes);
    assert.equal(info(end, bytes).Title, "override");
  });

  it("writes rich comments, markup, replies, and rotated coordinates", function () {
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(200, 300)
      .rotate(90)
      .comment("comment", "center", 20, {
        title: "author",
        subject: "subject",
        date: "2024-01-02T03:04:05Z",
        richText: true,
        open: true,
        flag: "locked",
        replies: [{ text: "reply", title: "reviewer" }],
      })
      .annot(20, 120, "Highlight", { width: 80, height: 12 })
      .annot(30, 180, "Square", { width: 40, height: 20, border: 2 })
      .endPage()
      .endPDF();
    writeOutput(end, "info-annotations", bytes);
    var keys = [
      "Subtype",
      "T",
      "Subj",
      "M",
      "F",
      "Open",
      "Rect",
      "RC",
      "Contents",
      "RT",
      "QuadPoints",
      "Border",
    ];
    var [comment, reply, highlight, square] = annotations(end, bytes);
    var rich =
      '<?xml version="1.0"?><body xmlns="http://www.w3.org/1999/xhtml">comment</body>';
    // the comment is rotated with the page, its date written in UTC
    assert.deepEqual(pick(comment, keys), {
      Subtype: "Text",
      T: "author",
      Subj: "subject",
      M: "D:20240102030405Z",
      F: 128,
      Open: true,
      Rect: [20, 100, 20, 100],
      RC: rich,
    });
    assert.deepEqual(pick(reply, keys), {
      Subtype: "Text",
      T: "reviewer",
      Subj: "subject",
      M: "D:20240102030405Z",
      F: 128,
      Open: true,
      Rect: [20, 100, 20, 100],
      Contents: "reply",
      RT: "R",
    });
    assert.deepEqual(pick(reply.IRT, keys), pick(comment, keys));
    assert.deepEqual(pick(highlight, ["Subtype", "Rect", "QuadPoints"]), {
      Subtype: "Highlight",
      Rect: [120, 20, 132, 100],
      QuadPoints: [120, 100, 132, 100, 120, 20, 132, 20],
    });
    assert.deepEqual(pick(square, ["Subtype", "Rect", "Border"]), {
      Subtype: "Square",
      Rect: [180, 30, 200, 70],
      Border: [0, 0, 2],
    });
  });

  it("keeps composition and metadata of a new PDF together", function () {
    var source = end
      .newRecipe({ compress: false })
      .createPage(100, 100)
      .endPage()
      .createPage(120, 100)
      .endPage()
      .endPDF();
    var name = end.pdf(writeOutput(end, "info-composition-source", source));
    var recipe = end
      .newRecipe({ compress: false })
      .info({ author: "browser", title: "metadata", keywords: ["one", "two"] })
      .custom("custom", "value")
      .appendPage(name, 1)
      .createPage(100, 100)
      .overlay(name, { page: 2, fitWidth: true })
      .endPage()
      .insertPage(0, name, 2);
    assert.deepEqual(recipe.info(), {
      author: "browser",
      title: "metadata",
      keywords: "one, two",
      custom: "value",
    });
    var bytes = recipe.endPDF();
    writeOutput(end, "info-composition", bytes);
    assert.equal(pageCount(end, bytes), 3);
  });

  it("keeps the Info entries when insertPage() rebuilds the PDF", function () {
    var name = end.pdf("recipe/test.pdf");
    var bytes = end
      .newRecipe()
      .info({ author: "A", title: "T" })
      .custom("custom", "value")
      .createPage(100, 100)
      .endPage()
      .insertPage(0, name, 1)
      .endPDF();
    writeOutput(end, "info-insert-page", bytes);
    assert.equal(pageCount(end, bytes), 2);
    var entries = info(end, bytes);
    assert.equal(entries.Author, "A");
    assert.equal(entries.Title, "T");
    assert.equal(entries.custom, "value");
    assert.match(entries.Producer, /^MuhammaraJS/);
  });

  it("exposes permission bits and returns the recipe from encrypt()", function () {
    var recipe = end.newRecipe();
    assert.equal(recipe.permission("print, copy"), 20);
    assert.equal(recipe.permission(), 4);
    assert.throws(() => recipe.permission("print, fly"), {
      message: "Unknown user access permission (fly)",
    });
    assert.strictEqual(recipe.encrypt(), recipe);
  });

  it("orders repeated and non-sequential insertPage calls", function () {
    var marker = end.newRecipe({ compress: false });
    ["S1", "S2", "S3"].forEach((label) =>
      marker
        .createPage(200, 200)
        .text(label, 25, 50, { font: "arial" })
        .endPage(),
    );
    var name = end.pdf(
      writeOutput(end, "info-insert-order-source", marker.endPDF()),
    );
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(200, 200)
      .text("B1", 10, 10, { font: "arial" })
      .endPage()
      .createPage(200, 200)
      .text("B2", 10, 10, { font: "arial" })
      .endPage()
      .insertPage(0, name, 1)
      .insertPage(2, name, 3)
      .insertPage(1, name, 2)
      .insertPage(1, name, 1)
      .endPDF();
    writeOutput(end, "info-insert-order", bytes);
    var labels = [];
    for (var index = 0; index < pageCount(end, bytes); index += 1) {
      labels.push(textRuns(end, bytes, index)[0].text);
    }
    assert.deepEqual(labels, ["S1", "B1", "S2", "S1", "B2", "S3"]);
  });
});
