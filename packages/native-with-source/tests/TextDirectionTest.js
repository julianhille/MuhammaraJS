var muhammara = require("@muhammara/native-with-source");
var textDirection = require("@muhammara/native-core/lib/text-direction");
var assert = require("chai").assert;
var path = require("path");

var Recipe = muhammara.Recipe;
var ARIAL = path.join(__dirname, "TestMaterials", "fonts", "arial.ttf");

/**
 * Read a page's decoded text runs in content stream order.
 *
 * @param {string} file PDF path.
 * @param {number} [pageIndex=0] Zero-based page index.
 * @returns {Array<{text: string, x: number, y: number}>} The runs.
 */
function pageText(file, pageIndex) {
  var reader = muhammara.createReader(file);
  var elements = reader.extractPageText(pageIndex || 0);
  reader.end();
  return elements.map(function (element) {
    return {
      text: element.text,
      x: element.textMatrix[4],
      y: element.textMatrix[5],
    };
  });
}

/**
 * Write lines with writeText on a new page and read them back.
 *
 * @param {string} name Output file name.
 * @param {Array<{text: string, options: (object|undefined)}>} lines Lines.
 * @returns {string[]} The decoded text of each line.
 */
function writeLines(name, lines) {
  var output = path.join(__dirname, "output", name + ".pdf");
  var writer = muhammara.createWriter(output);
  var page = writer.createPage(0, 0, 400, 400);
  var font = writer.getFontForFile(ARIAL);
  var context = writer.startPageContentContext(page);
  lines.forEach(function (line, index) {
    context.writeText(
      line.text,
      10,
      380 - index * 20,
      Object.assign({ font: font, size: 12 }, line.options),
    );
  });
  writer.writePage(page).end();
  return pageText(output).map(function (run) {
    return run.text;
  });
}

/**
 * Finish a Recipe and read back its first page.
 *
 * @param {Recipe} recipe The recipe.
 * @param {string} output Its output path.
 * @returns {Promise<Array<{text: string, x: number, y: number}>>} The runs.
 */
function finish(recipe, output) {
  return new Promise(function (resolve, reject) {
    try {
      recipe.endPage().endPDF(function () {
        resolve(pageText(output));
      });
    } catch (error) {
      reject(error);
    }
  });
}

describe("TextDirection", function () {
  describe("toVisual", function () {
    [
      ["Hebrew", "שלום עולם", "םלוע םולש"],
      ["numbers inside Hebrew", "מחיר 120 ש״ח", "ח״ש 120 ריחמ"],
      ["English inside Hebrew", "שלום abc def!", "!abc def םולש"],
      ["Hebrew inside English", "abc שלום def", "abc םולש def"],
      ["mirrored brackets", "שלום (עולם)", "(םלוע) םולש"],
      ["points on their letters", "שָׁלוֹם", "םוֹלשָׁ"],
      ["surrogate pairs", "שלום \u{1f600} עולם", "םלוע \u{1f600} םולש"],
      ["formatting characters", "‏שלום‎", "םולש"],
      ["whitespace at both ends", " שלום ", " םולש "],
      ["left-to-right text", "Hello, world.", "Hello, world."],
    ].forEach(function (testCase) {
      it("reorders " + testCase[0], function () {
        assert.equal(textDirection.toVisual(testCase[1]), testCase[2]);
      });
    });

    it("keeps paragraph breaks in place", function () {
      assert.equal(textDirection.toVisual("שלום\nabc def"), "םולש\nabc def");
      assert.equal(
        textDirection.toVisual("abc\u2029שלום עולם", "rtl"),
        "abc\u2029םלוע םולש",
      );
    });

    it("follows an explicit paragraph direction", function () {
      assert.equal(textDirection.toVisual("abc שלום", "ltr"), "abc םולש");
      assert.equal(textDirection.toVisual("abc שלום", "rtl"), "םולש abc");
      assert.equal(textDirection.toVisual("Hello.", "rtl"), ".Hello");
      assert.equal(textDirection.toVisual("abc שלום", "none"), "abc שלום");
    });

    it("rejects unknown directions", function () {
      assert.throws(function () {
        textDirection.toVisual("abc", "up");
      }, TypeError);
      assert.throws(function () {
        textDirection.readDirection("RTL");
      }, TypeError);
      assert.equal(textDirection.readDirection(null), "auto");
    });

    it("resolves each paragraph's direction", function () {
      var directionAt = textDirection.paragraphDirections(
        "Hello\nשלום abc\n\n123",
      );
      assert.equal(directionAt(0), "ltr");
      assert.equal(directionAt(6), "rtl");
      assert.equal(directionAt(15), "ltr");
      assert.equal(textDirection.paragraphDirections("שלום", "ltr")(0), "ltr");
    });
  });

  describe("writeText", function () {
    it("exposes the directions", function () {
      assert.deepEqual(muhammara.TextDirection, {
        AUTO: "auto",
        LTR: "ltr",
        RTL: "rtl",
        NONE: "none",
      });
      assert.strictEqual(Recipe.TextDirection, muhammara.TextDirection);
      assert.isUndefined(muhammara.PageContentContext);
      assert.isUndefined(muhammara.XObjectContentContext);
    });

    it("writes right-to-left text in visual order by default", function () {
      assert.deepEqual(
        writeLines("TextDirectionWriteText", [
          { text: "השועל החום המהיר" },
          { text: "מחיר 120 ש״ח" },
          { text: "abc שלום", options: { direction: "rtl" } },
          { text: "abc שלום", options: { direction: "ltr" } },
          { text: "שלום", options: { direction: "none" } },
          { text: "Hello, world." },
        ]),
        [
          "ריהמה םוחה לעושה",
          "ח״ש 120 ריחמ",
          "םולש abc",
          "abc םולש",
          "שלום",
          "Hello, world.",
        ],
      );
    });

    it("reorders text in forms and modified pages", function () {
      var output = path.join(__dirname, "output", "TextDirectionForms.pdf");
      var writer = muhammara.createWriter(output);
      var font = writer.getFontForFile(ARIAL);
      var forms = [
        { text: "שלום עולם" },
        { text: "םלוע םולש", direction: "none" },
      ].map(function (line) {
        var form = writer.createFormXObject(0, 0, 200, 50);
        form.getContentContext().writeText(line.text, 10, 10, {
          font: font,
          size: 12,
          direction: line.direction,
        });
        writer.endFormXObject(form);
        return form.id;
      });
      var page = writer.createPage(0, 0, 200, 200);
      writer.writePage(page).end();

      var reader = muhammara.createReader(output);
      var contents = forms.map(function (id) {
        var streamReader = reader.startReadingFromStream(
          reader.parseNewObject(id),
        );
        var chunks = [];
        while (streamReader.notEnded()) {
          chunks.push(Buffer.from(streamReader.read(65536)));
        }
        return Buffer.concat(chunks).toString("latin1");
      });
      reader.end();
      assert.equal(contents[0], contents[1]);

      var modified = path.join(
        __dirname,
        "output",
        "TextDirectionModified.pdf",
      );
      var modifier = muhammara.createWriterToModify(output, {
        modifiedFilePath: modified,
      });
      var pageModifier = new muhammara.PDFPageModifier(modifier, 0);
      // Page edits draw into a form, through the same reordering writeText.
      var form = modifier.createFormXObject(0, 0, 10, 10);
      assert.strictEqual(
        pageModifier.startContext().getContext().writeText,
        form.getContentContext().writeText,
      );
      modifier.endFormXObject(form);
      pageModifier.endContext().writePage();
      modifier.end();
    });

    it("rejects an unknown direction before writing", function () {
      var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
      var page = writer.createPage(0, 0, 200, 200);
      var context = writer.startPageContentContext(page);
      assert.throws(function () {
        context.writeText("abc", 10, 10, {
          font: writer.getFontForFile(ARIAL),
          direction: "up",
        });
      }, /direction must be/);
    });

    it("refuses an addon that does not export its content contexts", function () {
      var createMuhammara = require("@muhammara/native-core").createMuhammara;
      var PDFReader = function () {};
      PDFReader.prototype.extractPageText = function () {};
      assert.throws(function () {
        createMuhammara({ PDFWriter: function () {}, PDFReader: PDFReader });
      }, "does not export PageContentContext");
    });
  });

  describe("Recipe text", function () {
    it("draws each wrapped line in visual order", async function () {
      var output = path.join(__dirname, "output", "TextDirectionRecipe.pdf");
      var recipe = new Recipe("new", output);
      recipe.registerFont("arial", ARIAL);
      recipe
        .createPage(400, 400)
        .text("שלום עולם", 20, 20, { font: "arial", size: 12 })
        .text("אחת שתיים שלוש ארבע חמש", 20, 60, {
          font: "arial",
          size: 12,
          textBox: { width: 90 },
        })
        .text("Hello\nשלום abc", 20, 140, { font: "arial", size: 12 })
        .text("Hello\nשלום abc", 20, 200, {
          font: "arial",
          size: 12,
          direction: "ltr",
        })
        .text("שלום", 20, 260, { font: "arial", size: 12, direction: "none" });

      var runs = await finish(recipe, output);
      assert.deepEqual(
        runs.map(function (run) {
          return run.text;
        }),
        [
          "םלוע םולש",
          "שולש םייתש תחא",
          "שמח עברא",
          "Hello",
          "abc םולש",
          "Hello",
          "םולש abc",
          "שלום",
        ],
      );
    });

    it("places justified words from right to left", async function () {
      var output = path.join(__dirname, "output", "TextDirectionJustify.pdf");
      var recipe = new Recipe("new", output);
      recipe.registerFont("arial", ARIAL);
      recipe.createPage(400, 400).text("אחת שתיים שלוש ארבע חמש", 20, 20, {
        font: "arial",
        size: 12,
        textBox: { width: 120, textAlign: "justify" },
      });

      var runs = await finish(recipe, output);
      var firstLine = runs.filter(function (run) {
        return run.y === runs[0].y;
      });
      assert.deepEqual(
        firstLine.map(function (run) {
          return run.text;
        }),
        ["עברא", "שולש", "םייתש", "תחא"],
      );
      firstLine.slice(1).forEach(function (run, index) {
        assert.isBelow(firstLine[index].x, run.x);
      });
      assert.equal(runs[runs.length - 1].text, "שמח");
    });

    it("keeps non-breaking spaces inside justified words", async function () {
      var output = path.join(__dirname, "output", "TextDirectionNbsp.pdf");
      var recipe = new Recipe("new", output);
      recipe.registerFont("arial", ARIAL);
      recipe
        .createPage(400, 400)
        .text("אחת שתיים מחיר 120\u00a0ש״ח ארבע חמש שש שבע", 20, 20, {
          font: "arial",
          size: 12,
          textBox: { width: 150, textAlign: "justify" },
        });

      var runs = await finish(recipe, output);
      assert.include(
        runs.map(function (run) {
          return run.text;
        }),
        "ח״ש\u00a0120",
      );
    });

    it("keeps the indent of justified list items", async function () {
      var lefts = {};
      for (var direction of ["auto", "none"]) {
        var output = path.join(
          __dirname,
          "output",
          "TextDirectionIndent-" + direction + ".pdf",
        );
        var recipe = new Recipe("new", output);
        recipe.registerFont("arial", ARIAL);
        recipe
          .createPage(400, 400)
          .text(
            "<ul><li>אחת שתיים שלוש ארבע חמש שש שבע שמונה</li></ul>",
            20,
            20,
            {
              font: "arial",
              size: 12,
              html: true,
              direction: direction,
              textBox: { width: 120, textAlign: "justify" },
            },
          );
        var runs = await finish(recipe, output);
        var lineYs = runs
          .map(function (run) {
            return run.y;
          })
          .filter(function (y, index, ys) {
            return ys.indexOf(y) === index;
          });
        // The second line is wrapped, indented and justified.
        assert.isAbove(lineYs.length, 2);
        var secondLine = runs.filter(function (run) {
          return run.y === lineYs[1];
        });
        // Where the first word starts, after the indent.
        lefts[direction] = secondLine.find(function (run) {
          return run.text.trim() !== "";
        }).x;
      }
      assert.isAbove(lefts.none, 60);
      assert.closeTo(lefts.auto, lefts.none, 2);
    });

    it("rejects an unknown direction before drawing", function () {
      var recipe = new Recipe("new", path.join(__dirname, "output", "x.pdf"));
      recipe.createPage(200, 200);
      assert.throws(function () {
        recipe.text("abc", 10, 10, { direction: "up" });
      }, TypeError);
    });
  });
});
