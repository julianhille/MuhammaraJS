var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var muhammara = require("@muhammara/native-with-source");
var { writeOutput } = require("../helpers/testOutput");

var Recipe = muhammara.Recipe;

/**
 * Creates a PDF of blank pages, 200 by 300 points each, and ends it.
 * @param {number} pages The number of pages.
 * @param {function(Recipe): void} [bookmark] Adds bookmarks before the end.
 * @param {string} [name] Output name suffix; nothing is written without it.
 * @returns {Buffer} The PDF.
 */
function create(pages, bookmark, name) {
  var recipe = new Recipe(Buffer.from("new"));
  for (var page = 1; page <= pages; page++) {
    recipe.createPage(200, 300).endPage();
  }
  if (bookmark) bookmark(recipe);
  var bytes = recipe.endPDF((output) => output);
  if (name) writeOutput("bookmark-" + name, bytes);
  return bytes;
}

/**
 * Reads the outline of a PDF as a plain tree and checks that the links of the
 * items agree with the tree: /Parent, /Prev, /Next, /First and /Last.
 * @param {Buffer} bytes The PDF.
 * @returns {{count: number, children: Object[]}|null} The root with its
 *   items, each with title, count, dest ({page, kind, args}) and children, or
 *   null for a PDF without outline.
 */
function readOutline(bytes) {
  var reader = muhammara.createReader(new muhammara.PDFRStreamForBuffer(bytes));
  try {
    var pageIds = Array.from({ length: reader.getPagesCount() }, (_, index) =>
      reader.getPageObjectID(index),
    );
    var catalog = reader.queryDictionaryObject(reader.getTrailer(), "Root");
    var outlines = catalog.toPDFDictionary().toJSObject().Outlines;
    if (!outlines) return null;
    var idOf = (dictionary, key) =>
      dictionary[key]?.toPDFIndirectObjectReference().getObjectID();
    var load = (id) => reader.parseNewObject(id).toPDFDictionary().toJSObject();
    var rootId = outlines.toPDFIndirectObjectReference().getObjectID();
    var root = load(rootId);
    assert.equal(root.Type.value, "Outlines");
    var items = (parentId) => {
      var parent = load(parentId);
      var result = [];
      var previous;
      for (var id = idOf(parent, "First"); id;) {
        var item = load(id);
        assert.equal(idOf(item, "Parent"), parentId);
        assert.equal(idOf(item, "Prev"), previous);
        var children = items(id);
        var dest = item.Dest.toPDFArray().toJSArray();
        result.push({
          title: item.Title.toText(),
          count: item.Count?.value,
          dest: {
            page:
              pageIds.indexOf(
                dest[0].toPDFIndirectObjectReference().getObjectID(),
              ) + 1,
            kind: dest[1].value,
            args: dest
              .slice(2)
              .map((value) =>
                typeof value.value === "number" ? value.value : null,
              ),
          },
          children,
        });
        previous = id;
        id = idOf(item, "Next");
      }
      assert.equal(idOf(parent, "Last"), previous);
      return result;
    };
    return { count: root.Count?.value, children: items(rootId) };
  } finally {
    reader.end();
  }
}

/**
 * @param {string} title The title.
 * @param {number} page The page it opens.
 * @param {Object[]} [children] The items below it.
 * @param {number} [count] Its /Count.
 * @param {Object} [dest] Replaces the default /Fit destination.
 * @returns {Object} An item, as readOutline() gives it.
 */
function item(title, page, children = [], count, dest) {
  return {
    title,
    count,
    dest: dest || { page, kind: "Fit", args: [] },
    children,
  };
}

describe("Recipe bookmark", function () {
  this.timeout(30000);

  it("writes flat bookmarks that fit their page", function () {
    var bytes = create(
      3,
      (recipe) =>
        assert.equal(
          recipe.bookmark("One", 1).bookmark("Two", 2).bookmark("Three", 3),
          recipe,
        ),
      "flat",
    );
    assert.deepEqual(readOutline(bytes), {
      count: 3,
      children: [item("One", 1), item("Two", 2), item("Three", 3)],
    });
  });

  it("writes no outline without bookmarks", function () {
    assert.equal(readOutline(create(1)), null);
  });

  it("writes the position and zoom of a destination", function () {
    var bytes = create(
      3,
      (recipe) => {
        recipe
          .bookmark("Position", 1, { x: 10, y: 20 })
          .bookmark("Zoom", 2, { zoom: 2 })
          .bookmark("Both", 3, { x: 0, y: 300, zoom: 0.5 });
      },
      "destination",
    );
    var xyz = (page, ...args) => ({ page, kind: "XYZ", args });
    assert.deepEqual(readOutline(bytes).children, [
      item("Position", 1, [], undefined, xyz(1, 10, 280, null)),
      item("Zoom", 2, [], undefined, xyz(2, null, null, 2)),
      item("Both", 3, [], undefined, xyz(3, 0, 0, 0.5)),
    ]);
  });

  it("puts the position on the page as it is shown when rotated", function () {
    var recipe = new Recipe(Buffer.from("new"));
    recipe.createPage(200, 300).rotate(90).endPage();
    var bytes = recipe
      .bookmark("Rotated", 1, { x: 10, y: 20 })
      .endPDF((output) => output);
    assert.deepEqual(readOutline(bytes).children, [
      item("Rotated", 1, [], undefined, {
        page: 1,
        kind: "XYZ",
        args: [20, 10, null],
      }),
    ]);
  });

  it("places a destination on rotated pages with a shifted MediaBox", function () {
    [
      [90, [70, 70]],
      [180, [260, 80]],
      [270, [250, 370]],
    ].forEach(([angle, args]) => {
      var source = new Recipe(Buffer.from("new"))
        .createPage(300, 400)
        .setPageBox(muhammara.ePDFPageBoxMediaBox, 10, 20, 310, 420)
        .rotate(angle)
        .endPage()
        .endPDF((output) => output);
      var bytes = new Recipe(source)
        .bookmark("Rotated", 1, { x: 50, y: 60 })
        .endPDF((output) => output);
      assert.deepEqual(readOutline(bytes).children, [
        item("Rotated", 1, [], undefined, {
          page: 1,
          kind: "XYZ",
          args: [...args, null],
        }),
      ]);
    });
  });

  it("counts the visible items of nested bookmarks", function () {
    var bytes = create(
      4,
      (recipe) =>
        recipe
          .bookmark("A", 1, {
            open: true,
            children: [
              { title: "A1", pageNumber: 2 },
              {
                title: "A2",
                pageNumber: 3,
                children: [{ title: "A2a", pageNumber: 4 }],
              },
              {
                title: "A3",
                pageNumber: 3,
                open: true,
                children: [{ title: "A3a", pageNumber: 4 }],
              },
            ],
          })
          .bookmark("B", 4, {
            children: [
              {
                title: "B1",
                pageNumber: 4,
                open: true,
                children: [{ title: "B1a", pageNumber: 4 }],
              },
            ],
          }),
      "nested",
    );
    assert.deepEqual(readOutline(bytes), {
      // A, A1, A2, A3, A3a and B; B1 is hidden by the closed B
      count: 6,
      children: [
        item(
          "A",
          1,
          [
            item("A1", 2),
            item("A2", 3, [item("A2a", 4)], -1),
            item("A3", 3, [item("A3a", 4)], 1),
          ],
          4,
        ),
        item("B", 4, [item("B1", 4, [item("B1a", 4)], 1)], -2),
      ],
    });
  });

  it("writes Unicode titles as PDF text strings", function () {
    var titles = ["Café", "漢字 かな", "😀 emoji", "عربى", "a ( b ) \\ c"];
    var bytes = create(
      1,
      (recipe) => titles.forEach((title) => recipe.bookmark(title, 1)),
      "unicode",
    );
    assert.deepEqual(
      readOutline(bytes).children.map((child) => child.title),
      titles,
    );
    assert.ok(bytes.includes("(\\376\\377"), "UTF-16BE with a byte order mark");
    assert.ok(bytes.includes("(Caf\\351)"), "PDFDocEncoding");
  });

  it("opens a page created after the call", function () {
    var recipe = new Recipe(Buffer.from("new"));
    recipe.bookmark("Later", 2).createPage().endPage().createPage().endPage();
    assert.deepEqual(readOutline(recipe.endPDF((output) => output)).children, [
      item("Later", 2),
    ]);
  });

  it("rejects a page the document does not have at endPDF", function () {
    var recipe = new Recipe(Buffer.from("new"));
    recipe.createPage().endPage().bookmark("Gone", 1);
    recipe.bookmark("Missing", 2, {
      children: [{ title: "Deeper", pageNumber: 3 }],
    });
    assert.throws(
      () => recipe.endPDF(),
      new RangeError("bookmark targets page 2, but the document has 1 pages"),
    );
  });

  it("reads page geometry only for bookmarks with a position", function () {
    // perf-only mechanism of the native final pass, so it has no Wasm mirror
    [
      [{}, 0],
      [{ x: 10, y: 10 }, 1],
    ].forEach(([options, reads]) => {
      var recipe = new Recipe(Buffer.from("new"));
      recipe.createPage(200, 300).endPage();
      recipe.bookmark("A", 1, { children: [] });
      recipe.bookmark("B", 1, {
        children: [{ title: "C", pageNumber: 1, ...options }],
      });
      var calls = 0;
      var read = recipe.read;
      recipe.read = function (...args) {
        calls += 1;
        return read.apply(this, args);
      };
      recipe.endPDF();
      assert.equal(calls, reads);
    });
  });

  it("adds bookmarks to a source PDF, with edited and created pages", function () {
    var recipe = new Recipe(create(3));
    recipe.editPage(2).text("edited", 20, 20).comment("note", 20, 40).endPage();
    recipe
      .createPage(100, 100)
      .endPage()
      .bookmark("Edited", 2, { x: 10, y: 20 })
      .bookmark("Original", 3)
      .bookmark("Created", 4);
    var bytes = recipe.endPDF((output) => output);
    writeOutput("bookmark-source", bytes);
    assert.deepEqual(readOutline(bytes).children, [
      item("Edited", 2, [], undefined, {
        page: 2,
        kind: "XYZ",
        args: [10, 280, null],
      }),
      item("Original", 3),
      item("Created", 4),
    ]);
  });

  it("rejects a source PDF that has an outline", function () {
    var message =
      "bookmark() cannot add to a source PDF that already has an outline";
    var withOutline = create(1, (recipe) => recipe.bookmark("One", 1));
    assert.throws(
      () => new Recipe(withOutline).bookmark("Two", 1),
      new Error(message),
    );
    // an outline root with no items is still an outline
    var empty = Buffer.from(
      withOutline.toString("latin1").replace("/First ", "/Fxrst "),
      "latin1",
    );
    assert.throws(
      () => new Recipe(empty).bookmark("Two", 1),
      new Error(message),
    );
  });

  it("bookmarks the pages of the finished document after deletePage", function () {
    // the finished document is the old pages 1, 3 and 4
    var expected = [
      item("Old three", 2, [], undefined, {
        page: 2,
        kind: "XYZ",
        args: [10, 280, null],
      }),
      item("Old four", 3),
    ];
    [
      (recipe) =>
        recipe
          .deletePage(2)
          .bookmark("Old three", 2, { x: 10, y: 20 })
          .bookmark("Old four", 3),
      (recipe) =>
        recipe
          .bookmark("Old three", 2, { x: 10, y: 20 })
          .bookmark("Old four", 3)
          .deletePage(2),
    ].forEach((build) => {
      var bytes = build(new Recipe(create(4))).endPDF((output) => output);
      assert.deepEqual(readOutline(bytes).children, expected);
    });
  });

  it("rejects a page the finished document does not have, and still writes a valid PDF", function () {
    var output = path.join(
      __dirname,
      "../output/bookmark-finished-document.pdf",
    );
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output + ".src.pdf", create(3));
    var recipe = new Recipe(output + ".src.pdf", output);
    recipe.deletePage(2).bookmark("Gone", 3);
    assert.throws(
      () => recipe.endPDF(),
      new RangeError("bookmark targets page 3, but the document has 2 pages"),
    );
    var reader = muhammara.createReader(output);
    try {
      assert.equal(reader.getPagesCount(), 2);
    } finally {
      reader.end();
    }
    assert.equal(readOutline(fs.readFileSync(output)), null);
  });

  it("bookmarks pages added by appendPage", function () {
    var appended = path.join(__dirname, "../TestMaterials/recipe/test.pdf");
    [
      (recipe) =>
        recipe.appendPage(appended, [1, 2]).bookmark("Appended", 5, {
          children: [{ title: "Second", pageNumber: 6 }],
        }),
      (recipe) =>
        recipe
          .bookmark("Appended", 5, {
            children: [{ title: "Second", pageNumber: 6 }],
          })
          .appendPage(appended, [1, 2]),
    ].forEach((build) => {
      var bytes = build(new Recipe(create(4))).endPDF((output) => output);
      assert.deepEqual(readOutline(bytes), {
        count: 1,
        children: [item("Appended", 5, [item("Second", 6)], -1)],
      });
    });
  });

  it("bookmarks pages inserted by insertPage", function () {
    var inserted = path.join(__dirname, "../TestMaterials/recipe/test.pdf");
    var output = path.join(__dirname, "../output/bookmark-insert.pdf");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output + ".src.pdf", create(3));
    new Recipe(output + ".src.pdf", output)
      .insertPage(1, inserted, 1)
      .bookmark("Inserted", 2, { x: 10, y: 20 })
      .bookmark("After it", 3)
      .bookmark("Last", 4)
      .endPDF();
    var bytes = fs.readFileSync(output);
    // the inserted page is 612 by 792 points
    assert.deepEqual(readOutline(bytes).children, [
      item("Inserted", 2, [], undefined, {
        page: 2,
        kind: "XYZ",
        args: [10, 772, null],
      }),
      item("After it", 3),
      item("Last", 4),
    ]);
  });

  it("places a destination on a rotated page with a shifted MediaBox inserted by insertPage", function () {
    var inserted = path.join(__dirname, "../output/bookmark-rotated-src.pdf");
    var source = path.join(__dirname, "../output/bookmark-insert-src.pdf");
    var output = path.join(__dirname, "../output/bookmark-insert-rotated.pdf");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(
      inserted,
      new Recipe(Buffer.from("new"))
        .createPage(300, 400)
        .setPageBox(muhammara.ePDFPageBoxMediaBox, 10, 20, 310, 420)
        .rotate(90)
        .endPage()
        .endPDF((bytes) => bytes),
    );
    fs.writeFileSync(source, create(1));
    new Recipe(source, output)
      .insertPage(1, inserted, 1)
      .bookmark("Rotated", 2, { x: 50, y: 60 })
      .endPDF();
    // as the page rotated by 90 on its own in "places a destination on
    // rotated pages with a shifted MediaBox"
    assert.deepEqual(readOutline(fs.readFileSync(output)).children, [
      item("Rotated", 2, [], undefined, {
        page: 2,
        kind: "XYZ",
        args: [70, 70, null],
      }),
    ]);
  });

  it("validates its arguments and queues nothing on failure", function () {
    var recipe = new Recipe(Buffer.from("new"));
    recipe.createPage().endPage();
    [
      [["", 1], TypeError, "A bookmark needs a title"],
      [[1, 1], TypeError, "A bookmark needs a title"],
      [["a", "1"], RangeError, "pageNumber must identify an existing page"],
      [["a", 0], RangeError, "pageNumber must identify an existing page"],
      [["a", 1.5], RangeError, "pageNumber must identify an existing page"],
      [["a", 1, []], TypeError, "The options of a bookmark must be an object"],
      [["a", 1, { fit: true }], TypeError, "Unknown bookmark option fit"],
      [["a", 1, { open: 1 }], TypeError, /open option .* boolean/],
      [["a", 1, { x: 1 }], TypeError, "A bookmark needs x and y together"],
      [["a", 1, { x: NaN, y: 1 }], TypeError, /x and y .* within/],
      [["a", 1, { zoom: 0 }], TypeError, /zoom .* positive/],
      [["a", 1, { zoom: Infinity }], TypeError, /zoom .* positive/],
      [["a", 1, { children: {} }], TypeError, /children .* array/],
      [["a", 1, { children: [null] }], TypeError, /child bookmark .* object/],
      [
        ["a", 1, { children: [{ title: "b", pageNumber: 0 }] }],
        RangeError,
        "pageNumber must identify an existing page",
      ],
      [
        ["a", 1, { children: [{ title: "b", pageNumber: 1, zoom: -1 }] }],
        TypeError,
        /zoom .* positive/,
      ],
    ].forEach(([args, type, message]) =>
      assert.throws(
        () => recipe.bookmark(...args),
        (error) => {
          assert.ok(error instanceof type, String(args));
          assert.match(error.message, new RegExp(message));
          return true;
        },
      ),
    );
    assert.equal(
      recipe.endPDF((output) => output).includes("/Outlines"),
      false,
    );
  });

  it("rejects sparse children at the call", function () {
    var recipe = new Recipe(Buffer.from("new"));
    recipe.createPage().endPage();
    assert.throws(
      () => recipe.bookmark("a", 1, { children: new Array(1) }),
      TypeError,
    );
  });

  it("rejects x, y and zoom beyond 2147483647", function () {
    var recipe = new Recipe(Buffer.from("new"));
    recipe.createPage().endPage();
    [{ x: 1e308, y: 1 }, { x: 1, y: -2147483648 }, { zoom: 1e308 }].forEach(
      (options) =>
        assert.throws(() => recipe.bookmark("a", 1, options), TypeError),
    );
    [
      { x: "5", y: 1 },
      { x: null, y: 1 },
      { x: true, y: 1 },
      { zoom: "2" },
    ].forEach((options) =>
      assert.throws(() => recipe.bookmark("a", 1, options), TypeError),
    );
    recipe.bookmark("a", 1, {
      x: 2147483647,
      y: -2147483647,
      zoom: 2147483647,
    });
  });

  it("rejects a NUL in a title", function () {
    var recipe = new Recipe(Buffer.from("new"));
    recipe.createPage().endPage();
    assert.throws(
      () => recipe.bookmark("a\0b", 1),
      new TypeError("A bookmark title cannot contain NUL"),
    );
  });

  it("writes the outline for PDF/A-4", function () {
    // PDF/A-4 writes no Info dictionary; the outline must still be written
    var recipe = new Recipe(Buffer.from("new"), undefined, {
      pdfa: {
        level: Recipe.PdfA.A4,
        iccProfile: path.join(
          __dirname,
          "../TestMaterials/icc/sRGB-v2-micro.icc",
        ),
      },
    });
    recipe.createPage().text("x", 72, 72).endPage().bookmark("One", 1);
    var bytes = recipe.endPDF((output) => output);
    assert.deepEqual(readOutline(bytes).children, [item("One", 1)]);
  });

  it("nests up to 64 levels", function () {
    var nest = (levels) => {
      var options = {};
      for (var level = levels; level > 1; level--) {
        options = { children: [{ title: "t", pageNumber: 1, ...options }] };
      }
      return options;
    };
    var recipe = new Recipe(Buffer.from("new"));
    recipe.createPage().endPage().bookmark("t", 1, nest(64));
    assert.throws(
      () => recipe.bookmark("t", 1, nest(65)),
      new RangeError("Bookmarks can nest at most 64 levels"),
    );
    recipe.endPDF();
  });

  it("throws after endPDF", function () {
    var recipe = new Recipe(Buffer.from("new"));
    recipe.createPage().endPage().endPDF();
    assert.throws(
      () => recipe.bookmark("One", 1),
      new Error("PDF writer has ended"),
    );
  });

  it("keeps the outline of an encrypted PDF readable", function () {
    var recipe = new Recipe(Buffer.from("new"), undefined, {
      userPassword: "user",
      ownerPassword: "owner",
    });
    recipe.createPage().endPage().bookmark("Secret é", 1);
    var bytes = recipe.endPDF((output) => output);
    assert.equal(bytes.includes("Secret"), false);
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(bytes),
      { password: "user" },
    );
    try {
      var root = reader.queryDictionaryObject(reader.getTrailer(), "Root");
      var first = reader.queryDictionaryObject(
        reader.queryDictionaryObject(root, "Outlines"),
        "First",
      );
      assert.equal(
        reader.queryDictionaryObject(first, "Title").toText(),
        "Secret é",
      );
    } finally {
      reader.end();
    }
  });

  it("works with annotations and PDF/A", function () {
    var recipe = new Recipe(Buffer.from("new"), undefined, {
      pdfa: {
        level: Recipe.PdfA.A3B,
        iccProfile: path.join(
          __dirname,
          "../TestMaterials/icc/sRGB-v2-micro.icc",
        ),
      },
    });
    recipe
      .createPage()
      .text("x", 72, 72)
      .comment("note", 72, 100)
      .endPage()
      .attach("a", Buffer.from("x"))
      .bookmark("One", 1);
    assert.deepEqual(readOutline(recipe.endPDF((output) => output)).children, [
      item("One", 1),
    ]);
  });

  it("keeps the outline pass out of the metadata of PDF/A files", function () {
    [Recipe.PdfA.A3B, Recipe.PdfA.A4].forEach((level) => {
      var recipe = new Recipe(Buffer.from("new"), undefined, {
        pdfa: {
          level,
          iccProfile: path.join(
            __dirname,
            "../TestMaterials/icc/sRGB-v2-micro.icc",
          ),
        },
      });
      var bytes = recipe
        .createPage()
        .text("x", 72, 72)
        .endPage()
        .bookmark("One", 1)
        .endPDF((output) => output);
      assert.deepEqual(readOutline(bytes).children, [item("One", 1)]);
      var text = bytes.toString("latin1");
      // one XMP packet, with the date the Info dictionary of the pass over
      // the finished file still has, if the level has an Info dictionary
      var xmp = [...text.matchAll(/<xmp:ModifyDate>([^<]*)</g)].map(
        (match) => match[1],
      );
      assert.equal(xmp.length, 1);
      var infos = [...text.matchAll(/\/ModDate \(D:(\d{14})/g)].map(
        (match) => match[1],
      );
      assert.equal(infos.length, level === Recipe.PdfA.A4 ? 0 : 2);
      infos.forEach((date) =>
        assert.equal(xmp[0].replace(/\D/g, "").slice(0, 14), date),
      );
    });
  });

  it("writes thousands of bookmarks", function () {
    var bytes = create(1, (recipe) => {
      for (var index = 0; index < 2000; index++) recipe.bookmark("b", 1);
      var children = [];
      for (var group = 0; group < 20; group++) {
        children.push({
          title: "g",
          pageNumber: 1,
          open: true,
          children: Array.from({ length: 10 }, () => ({
            title: "m",
            pageNumber: 1,
            open: true,
            children: Array.from({ length: 9 }, () => ({
              title: "l",
              pageNumber: 1,
            })),
          })),
        });
      }
      recipe.bookmark("tree", 1, { open: true, children });
    });
    // 2000 flat, the tree item, 20 groups, 200 middle items, 1800 leaves
    assert.equal(readOutline(bytes).count, 4021);
  });
});
