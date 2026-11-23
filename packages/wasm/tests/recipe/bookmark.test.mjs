// Ports tests/recipe/bookmark.js.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe, recipeFixture } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

var muhammara;
var Recipe;

/**
 * Creates a PDF of blank pages, 200 by 300 points each, and ends it.
 * @param {number} pages The number of pages.
 * @param {function(Recipe): void} [bookmark] Adds bookmarks before the end.
 * @param {string} [name] Output name suffix; nothing is written without it.
 * @returns {Uint8Array} The PDF.
 */
function create(pages, bookmark, name) {
  var recipe = new Recipe();
  for (var page = 1; page <= pages; page++) {
    recipe.createPage(200, 300).endPage();
  }
  if (bookmark) bookmark(recipe);
  var bytes = recipe.endPDF();
  if (name) writeOutput("bookmark-" + name, bytes);
  return bytes;
}

/**
 * Reads the outline of a PDF as a plain tree and checks that the links of the
 * items agree with the tree: /Parent, /Prev, /Next, /First and /Last.
 * @param {Uint8Array} bytes The PDF.
 * @returns {{count: number, children: Object[]}|null} The root with its
 *   items, each with title, count, dest ({page, kind, args}) and children, or
 *   null for a PDF without outline.
 */
function readOutline(bytes) {
  var reader = muhammara.createReader(bytes);
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
        var dest = item.Dest?.toPDFArray().toJSArray();
        result.push({
          title: item.Title.toText(),
          count: item.Count?.value,
          dest: dest && {
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

/**
 * Writes the outline root of a PDF again, in a revision of its own.
 * @param {Uint8Array} bytes The PDF, with an outline.
 * @param {function(Object, {first: number, last: number}): void} write
 *   Writes the entries of the root after its /Type; gets the object IDs of
 *   the first and the last item, the root itself and a spare object ID
 *   that `extra` writes.
 * @param {function(Object, number): void} [extra] Writes the spare object;
 *   gets the objects context and its ID.
 * @returns {Uint8Array} The PDF with the new root.
 */
function editRoot(bytes, write, extra) {
  var reader = muhammara.createReader(bytes);
  var rootId, ids;
  try {
    var catalog = reader.queryDictionaryObject(reader.getTrailer(), "Root");
    rootId = catalog
      .toPDFDictionary()
      .toJSObject()
      .Outlines.toPDFIndirectObjectReference()
      .getObjectID();
    var root = reader.parseNewObject(rootId).toPDFDictionary().toJSObject();
    ids = {
      first: root.First.toPDFIndirectObjectReference().getObjectID(),
      last: root.Last.toPDFIndirectObjectReference().getObjectID(),
      root: rootId,
    };
  } finally {
    reader.end();
  }
  var writer = muhammara.createWriterToModify(bytes);
  var objects = writer.getObjectsContext();
  if (extra) {
    ids.extra = objects.allocateNewObjectID();
    extra(objects, ids.extra);
  }
  objects.startModifiedIndirectObject(rootId);
  var dictionary = objects.startDictionary();
  dictionary.writeKey("Type");
  dictionary.writeNameValue("Outlines");
  write(dictionary, ids);
  objects.endDictionary(dictionary);
  objects.endIndirectObject();
  return writer.end();
}

/**
 * Replaces the value of /Outlines in the catalog by one of the same length.
 * @param {Uint8Array} bytes The PDF, with an outline.
 * @param {string} value The new value.
 * @returns {Uint8Array} The PDF.
 */
function replaceOutlines(bytes, value) {
  return Buffer.from(
    Buffer.from(bytes)
      .toString("latin1")
      .replace(/\/Outlines \d+ 0 R/, (reference) =>
        ("/Outlines " + value).padEnd(reference.length),
      ),
    "latin1",
  );
}

// three levels, with open and closed items
var OLD_OUTLINE = [
  item("A", 1, [item("A1", 1), item("A2", 2, [item("A2a", 2)], -1)], 2),
  item("B", 3, [item("B1", 3)], -1),
  item("C", 4),
];

/**
 * @returns {Buffer} A PDF of four pages with the outline OLD_OUTLINE.
 */
function createOutlined() {
  return create(4, (recipe) =>
    recipe
      .bookmark("A", 1, {
        open: true,
        children: [
          { title: "A1", pageNumber: 1 },
          {
            title: "A2",
            pageNumber: 2,
            children: [{ title: "A2a", pageNumber: 2 }],
          },
        ],
      })
      .bookmark("B", 3, { children: [{ title: "B1", pageNumber: 3 }] })
      .bookmark("C", 4),
  );
}

/**
 * Creates a PDF 1.5 of one page whose outline, a root and one item "Old",
 * is stored in an object stream.
 * @returns {Uint8Array} The PDF.
 */
function createObjectStreamPdf() {
  var parts = [Buffer.from("%PDF-1.5\n")];
  var size = () => parts.reduce((total, part) => total + part.length, 0);
  var offsets = [];
  var add = (id, body) => {
    offsets[id] = size();
    parts.push(Buffer.from(`${id} 0 obj\n${body}\nendobj\n`, "latin1"));
  };
  add(1, "<< /Type /Catalog /Pages 2 0 R /Outlines 4 0 R >>");
  add(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  add(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] >>");
  var root = "<< /Type /Outlines /First 5 0 R /Last 5 0 R /Count 1 >>";
  var last = "<< /Title (Old) /Parent 4 0 R /Dest [3 0 R /Fit] >>";
  var header = `4 0 5 ${root.length + 1} `;
  var data = `${header}${root} ${last}`;
  add(
    6,
    `<< /Type /ObjStm /N 2 /First ${header.length} /Length ${data.length} >>\nstream\n${data}\nendstream`,
  );
  var xrefAt = size();
  // the cross-reference stream: type, offset or stream, index or generation
  var entry = (type, a, b) => {
    var bytes = Buffer.alloc(7);
    bytes[0] = type;
    bytes.writeUInt32BE(a, 1);
    bytes.writeUInt16BE(b, 5);
    return bytes;
  };
  var xref = Buffer.concat([
    entry(0, 0, 65535),
    entry(1, offsets[1], 0),
    entry(1, offsets[2], 0),
    entry(1, offsets[3], 0),
    entry(2, 6, 0),
    entry(2, 6, 1),
    entry(1, offsets[6], 0),
    entry(1, xrefAt, 0),
  ]);
  parts.push(
    Buffer.from(
      `7 0 obj\n<< /Type /XRef /Size 8 /W [1 4 2] /Root 1 0 R /Length ${xref.length} >>\nstream\n`,
    ),
    xref,
    Buffer.from(`\nendstream\nendobj\nstartxref\n${xrefAt}\n%%EOF\n`),
  );
  return Buffer.concat(parts);
}

describe("Recipe bookmark", function () {
  this.timeout(30000);

  before(async function () {
    muhammara = await createMuhammaraWasm();
    Recipe = await getRecipe();
    Recipe.registerPdf("other", recipeFixture("test"));
  });

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
    var recipe = new Recipe();
    recipe.createPage(200, 300).rotate(90).endPage();
    var bytes = recipe.bookmark("Rotated", 1, { x: 10, y: 20 }).endPDF();
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
      var source = new Recipe()
        .createPage(300, 400)
        .setPageBox(muhammara.ePDFPageBoxMediaBox, 10, 20, 310, 420)
        .rotate(angle)
        .endPage()
        .endPDF();
      var bytes = new Recipe(source)
        .bookmark("Rotated", 1, { x: 50, y: 60 })
        .endPDF();
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
    assert.ok(
      Buffer.from(bytes).includes("(\\376\\377"),
      "UTF-16BE with a byte order mark",
    );
    assert.ok(Buffer.from(bytes).includes("(Caf\\351)"), "PDFDocEncoding");
  });

  it("opens a page created after the call", function () {
    var recipe = new Recipe();
    recipe.bookmark("Later", 2).createPage().endPage().createPage().endPage();
    assert.deepEqual(readOutline(recipe.endPDF()).children, [item("Later", 2)]);
  });

  it("rejects a page the document does not have at endPDF", function () {
    var recipe = new Recipe();
    recipe.createPage().endPage().bookmark("Gone", 1);
    recipe.bookmark("Missing", 2, {
      children: [{ title: "Deeper", pageNumber: 3 }],
    });
    assert.throws(
      () => recipe.endPDF(),
      new RangeError("bookmark targets page 2, but the document has 1 pages"),
    );
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
    var bytes = recipe.endPDF();
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

  it("appends to the outline of a source PDF", function () {
    var old = createOutlined();
    assert.deepEqual(readOutline(old), { count: 5, children: OLD_OUTLINE });
    var bytes = new Recipe(old)
      .bookmark("D", 1)
      .bookmark("E", 2, {
        open: true,
        children: [{ title: "E1", pageNumber: 3 }],
      })
      .endPDF();
    writeOutput("bookmark-append", bytes);
    // the old items stay as they are, the root counts all visible items
    assert.deepEqual(readOutline(bytes), {
      count: 8,
      children: [
        ...OLD_OUTLINE,
        item("D", 1),
        item("E", 2, [item("E1", 3)], 1),
      ],
    });
  });

  it("appends to an empty outline", function () {
    var empty = editRoot(createOutlined(), () => {});
    assert.deepEqual(readOutline(empty), { count: undefined, children: [] });
    var bytes = new Recipe(empty).bookmark("D", 1).bookmark("E", 2).endPDF();
    assert.deepEqual(readOutline(bytes), {
      count: 2,
      children: [item("D", 1), item("E", 2)],
    });
  });

  it("appends to an outline whose root has extra keys and no /Count", function () {
    var old = editRoot(createOutlined(), (dictionary, { first, last }) => {
      dictionary.writeKey("First");
      dictionary.writeObjectReferenceValue(first);
      dictionary.writeKey("Last");
      dictionary.writeObjectReferenceValue(last);
      dictionary.writeKey("Extra");
      dictionary.writeNameValue("Kept");
    });
    var bytes = new Recipe(old).bookmark("D", 1).endPDF();
    // the root in the first revision and the one the pass wrote
    assert.equal(
      Buffer.from(bytes).toString("latin1").split("/Extra /Kept").length,
      3,
    );
    assert.deepEqual(readOutline(bytes), {
      count: 1,
      children: [...OLD_OUTLINE, item("D", 1)],
    });
  });

  it("reads the /Count of the root by its magnitude", function () {
    var old = editRoot(createOutlined(), (dictionary, { first, last }) => {
      dictionary.writeKey("First");
      dictionary.writeObjectReferenceValue(first);
      dictionary.writeKey("Last");
      dictionary.writeObjectReferenceValue(last);
      dictionary.writeKey("Count");
      dictionary.writeNumberValue(-5);
    });
    var bytes = new Recipe(old).bookmark("D", 1).endPDF();
    assert.equal(readOutline(bytes).count, 6);
  });

  it("rejects an outline that is not an indirect dictionary", function () {
    var message =
      "bookmark() cannot add to the outline of this PDF: its /Outlines is not an indirect dictionary";
    ["<<>>"].forEach((value) => {
      var recipe = new Recipe(replaceOutlines(createOutlined(), value));
      recipe.bookmark("D", 1);
      assert.throws(() => recipe.endPDF(), new Error(message));
    });
  });

  it("rejects an outline without /Last", function () {
    var old = editRoot(createOutlined(), (dictionary, { first }) => {
      dictionary.writeKey("First");
      dictionary.writeObjectReferenceValue(first);
    });
    var recipe = new Recipe(old).bookmark("D", 1);
    assert.throws(
      () => recipe.endPDF(),
      new Error(
        "bookmark() cannot add to the outline of this PDF: its outline has no /Last",
      ),
    );
  });

  /**
   * @param {Recipe} recipe The Recipe to end.
   * @returns {Uint8Array} The PDF.
   */
  function endBytes(recipe) {
    return recipe.endPDF();
  }

  /**
   * Appends a bookmark to a PDF whose outline root has a given /Last.
   * @param {function(Object, Object): void} last Writes the value of /Last.
   * @param {function(Object, number): void} [extra] Writes the spare object.
   * @returns {Recipe} The Recipe, with the bookmark and not ended.
   */
  function withLast(last, extra) {
    var old = editRoot(
      createOutlined(),
      (dictionary, ids) => {
        dictionary.writeKey("First");
        dictionary.writeObjectReferenceValue(ids.first);
        dictionary.writeKey("Last");
        last(dictionary, ids);
      },
      extra,
    );
    return new Recipe(old).bookmark("D", 1);
  }

  it("reports an outline whose last item is not a dictionary", function () {
    var message =
      "bookmark() cannot add to the outline of this PDF: its outline has no /Last";
    [
      (dictionary) => dictionary.writeNumberValue(5),
      (dictionary, ids) => dictionary.writeObjectReferenceValue(ids.extra),
      (dictionary) => dictionary.writeObjectReferenceValue(99999),
    ].forEach((last, index) => {
      var recipe = withLast(last, (objects, id) => {
        objects.startNewIndirectObject(id);
        objects.startArray().endArray();
        objects.endIndirectObject();
      });
      assert.throws(() => endBytes(recipe), new Error(message), String(index));
    });
  });

  it("reports an outline whose last item is its root", function () {
    var recipe = withLast((dictionary, ids) =>
      dictionary.writeObjectReferenceValue(ids.root),
    );
    assert.throws(
      () => endBytes(recipe),
      new Error(
        "bookmark() cannot add to the outline of this PDF: its outline has no /Last",
      ),
    );
  });

  it("reports an /Outlines that points at nothing", function () {
    var recipe = new Recipe(replaceOutlines(createOutlined(), "99 0 R"));
    recipe.bookmark("D", 1);
    assert.throws(
      () => endBytes(recipe),
      new Error(
        "bookmark() cannot add to the outline of this PDF: its /Outlines is not an indirect dictionary",
      ),
    );
  });

  it("treats a null /Outlines as no outline", function () {
    var bytes = endBytes(
      new Recipe(replaceOutlines(createOutlined(), "null")).bookmark("D", 1),
    );
    assert.deepEqual(readOutline(bytes), {
      count: 1,
      children: [item("D", 1)],
    });
  });

  it("reads a real and an indirect /Count of the old outline", function () {
    [
      [(dictionary) => dictionary.writeNumberValue(2.5), 3],
      [(dictionary, ids) => dictionary.writeObjectReferenceValue(ids.extra), 8],
    ].forEach(([count, expected]) => {
      var old = editRoot(
        createOutlined(),
        (dictionary, ids) => {
          dictionary.writeKey("First");
          dictionary.writeObjectReferenceValue(ids.first);
          dictionary.writeKey("Last");
          dictionary.writeObjectReferenceValue(ids.last);
          dictionary.writeKey("Count");
          count(dictionary, ids);
        },
        (objects, id) => {
          objects.startNewIndirectObject(id);
          objects.writeNumber(7);
          objects.endIndirectObject();
        },
      );
      var bytes = endBytes(new Recipe(old).bookmark("D", 1));
      assert.equal(readOutline(bytes).count, expected);
    });
  });

  it("keeps the root /Count within 2147483647", function () {
    var old = editRoot(createOutlined(), (dictionary, ids) => {
      dictionary.writeKey("First");
      dictionary.writeObjectReferenceValue(ids.first);
      dictionary.writeKey("Last");
      dictionary.writeObjectReferenceValue(ids.last);
      dictionary.writeKey("Count");
      dictionary.writeNumberValue(2147483647);
    });
    var bytes = endBytes(new Recipe(old).bookmark("D", 1));
    assert.equal(readOutline(bytes).count, 2147483647);
  });

  it("appends after deletePage pruned the old outline", function () {
    var bytes = new Recipe(createOutlined())
      .deletePage(2, { pruneReferences: true })
      .bookmark("D", 3)
      .endPDF();
    var outline = readOutline(bytes);
    // the pruned destination of A2 and A2a stays pruned, the new one is
    // the third page of the finished document
    assert.deepEqual(
      outline.children.map((entry) => entry.title),
      ["A", "B", "C", "D"],
    );
    assert.deepEqual(outline.children[3], item("D", 3));
    assert.equal(outline.children[0].children[1].dest, undefined);
    assert.equal(outline.count, 6);
  });

  it("appends to the outline of a source with edited and created pages", function () {
    var bytes = new Recipe(createOutlined())
      .editPage(2)
      .text("edited", 20, 20)
      .comment("note", 20, 40)
      .endPage()
      .createPage(100, 100)
      .endPage()
      .bookmark("Edited", 2)
      .bookmark("Created", 5)
      .endPDF();
    assert.deepEqual(readOutline(bytes), {
      count: 7,
      children: [...OLD_OUTLINE, item("Edited", 2), item("Created", 5)],
    });
  });

  it("appends to a 2,000-item outline", function () {
    var old = create(1, (recipe) => {
      for (var index = 0; index < 2000; index++) recipe.bookmark("b", 1);
    });
    var bytes = new Recipe(old).bookmark("last", 1).endPDF();
    var outline = readOutline(bytes);
    assert.equal(outline.count, 2001);
    assert.equal(outline.children.length, 2001);
    assert.equal(outline.children[2000].title, "last");
  });

  it("appends to an outline stored in an object stream", function () {
    var bytes = new Recipe(createObjectStreamPdf()).bookmark("New", 1).endPDF();
    assert.deepEqual(readOutline(bytes), {
      count: 2,
      children: [item("Old", 1), item("New", 1)],
    });
  });

  it("appends to the outline of a PDF/A source", function () {
    var old = new Recipe({
      pdfa: {
        level: Recipe.PdfA.A3B,
        iccProfile: readFileSync(
          new URL(
            "../../../native-with-source/tests/TestMaterials/icc/sRGB-v2-micro.icc",
            import.meta.url,
          ),
        ),
      },
    })
      .createPage()
      .text("x", 72, 72)
      .endPage()
      .bookmark("Old", 1)
      .endPDF();
    var bytes = new Recipe(old).bookmark("New", 1).endPDF();
    assert.deepEqual(readOutline(bytes), {
      count: 2,
      children: [item("Old", 1), item("New", 1)],
    });
    // the XMP packet is still the only one
    assert.equal(
      Buffer.from(bytes).toString("latin1").split("<xmp:ModifyDate>").length,
      2,
    );
  });

  it("replaces the outline an insertPage rebuild dropped", function () {
    var bytes = new Recipe(createOutlined())
      .insertPage(1, "other", 1)
      .bookmark("Fresh", 2)
      .endPDF();
    assert.deepEqual(readOutline(bytes), {
      count: 1,
      children: [item("Fresh", 2)],
    });
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
      var bytes = build(new Recipe(create(4))).endPDF();
      assert.deepEqual(readOutline(bytes).children, expected);
    });
  });

  it("rejects a page the finished document does not have, and still writes a valid PDF", function () {
    var recipe = new Recipe(create(3));
    recipe.deletePage(2).bookmark("Gone", 3);
    var message = "bookmark targets page 3, but the document has 2 pages";
    assert.throws(() => recipe.endPDF(), new RangeError(message));
    // the Recipe is not retired: the next call fails the same way
    assert.throws(() => recipe.endPDF(), new RangeError(message));
    // without the bookmark the same document is complete and has no outline
    var bytes = new Recipe(create(3)).deletePage(2).endPDF();
    assert.equal(muhammara.createReader(bytes).getPagesCount(), 2);
    assert.equal(readOutline(bytes), null);
  });

  it("bookmarks pages added by appendPage", function () {
    var expected = {
      count: 1,
      children: [item("Appended", 5, [item("Second", 6)], -1)],
    };
    var bookmark = (recipe) =>
      recipe.bookmark("Appended", 5, {
        children: [{ title: "Second", pageNumber: 6 }],
      });
    [
      (recipe) => bookmark(recipe.appendPage("other", [1, 2])),
      (recipe) => bookmark(recipe).appendPage("other", [1, 2]),
    ].forEach((build) => {
      assert.deepEqual(
        readOutline(build(new Recipe(create(4))).endPDF()),
        expected,
      );
    });
    // in a new document
    var recipe = new Recipe();
    for (var page = 0; page < 4; page++) recipe.createPage().endPage();
    assert.deepEqual(
      readOutline(bookmark(recipe.appendPage("other", [1, 2])).endPDF()),
      expected,
    );
  });

  it("bookmarks pages inserted by insertPage", function () {
    var bytes = new Recipe(create(3))
      .insertPage(1, "other", 1)
      .bookmark("Inserted", 2, { x: 10, y: 20 })
      .bookmark("After it", 3)
      .bookmark("Last", 4)
      .endPDF();
    writeOutput("bookmark-insert", bytes);
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
    Recipe.registerPdf(
      "rotated-shifted",
      new Recipe()
        .createPage(300, 400)
        .setPageBox(muhammara.ePDFPageBoxMediaBox, 10, 20, 310, 420)
        .rotate(90)
        .endPage()
        .endPDF(),
    );
    var bytes = new Recipe(create(1))
      .insertPage(1, "rotated-shifted", 1)
      .bookmark("Rotated", 2, { x: 50, y: 60 })
      .endPDF();
    // as the page rotated by 90 on its own in "places a destination on
    // rotated pages with a shifted MediaBox"
    assert.deepEqual(readOutline(bytes).children, [
      item("Rotated", 2, [], undefined, {
        page: 2,
        kind: "XYZ",
        args: [70, 70, null],
      }),
    ]);
  });

  it("returns the same bytes for a second endPDF()", function () {
    var recipe = new Recipe(create(3))
      .insertPage(1, "other", 1)
      .bookmark("One", 1);
    assert.equal(recipe.endPDF(), recipe.endPDF());
  });

  it("writes no outline pass without bookmarks", function () {
    var recipe = new Recipe(create(2)).insertPage(1, "other", 1);
    assert.equal(readOutline(recipe.endPDF()), null);
    assert.equal(recipe._outlinedBytes, undefined);
  });

  it("validates its arguments and queues nothing on failure", function () {
    var recipe = new Recipe();
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
    assert.equal(Buffer.from(recipe.endPDF()).includes("/Outlines"), false);
  });

  it("rejects sparse children at the call", function () {
    var recipe = new Recipe();
    recipe.createPage().endPage();
    assert.throws(
      () => recipe.bookmark("a", 1, { children: new Array(1) }),
      TypeError,
    );
  });

  it("rejects x, y and zoom beyond 2147483647", function () {
    var recipe = new Recipe();
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
    var recipe = new Recipe();
    recipe.createPage().endPage();
    assert.throws(
      () => recipe.bookmark("a\0b", 1),
      new TypeError("A bookmark title cannot contain NUL, U+FFFE or U+FFFF"),
    );
  });

  it("rejects U+FFFE and U+FFFF in a title", function () {
    ["\uFFFEx", "x\uFFFE", "\uFFFFx", "x\uFFFF"].forEach((title) => {
      var recipe = new Recipe();
      assert.throws(
        () => recipe.bookmark(title, 1),
        new TypeError("A bookmark title cannot contain NUL, U+FFFE or U+FFFF"),
      );
    });
  });

  it("limits the length of a title", function () {
    var limit = 16382;
    var recipe = new Recipe();
    recipe.createPage().endPage();
    recipe.bookmark("a".repeat(limit), 1);
    var message = `A bookmark title can have at most ${limit} UTF-16 code units`;
    assert.throws(
      () => recipe.bookmark("a".repeat(limit + 1), 1),
      new RangeError(message),
    );
    // a surrogate pair counts as 2 units
    recipe.bookmark("\u{1F600}".repeat(limit / 2), 1);
    assert.throws(
      () => recipe.bookmark("\u{1F600}".repeat(limit / 2 + 1), 1),
      new RangeError(message),
    );
    assert.throws(
      () => recipe.bookmark("a".repeat(50 * 1024 * 1024), 1),
      new RangeError(message),
    );
    // a child is checked too, and nothing of the failed call is added
    assert.throws(
      () =>
        recipe.bookmark("ok", 1, {
          children: [{ title: "b".repeat(limit + 1), pageNumber: 1 }],
        }),
      new RangeError(message),
    );
  });

  it("writes the outline for PDF/A-4", function () {
    // PDF/A-4 writes no Info dictionary; the outline must still be written
    var recipe = new Recipe({
      pdfa: {
        level: Recipe.PdfA.A4,
        iccProfile: readFileSync(
          new URL(
            "../../../native-with-source/tests/TestMaterials/icc/sRGB-v2-micro.icc",
            import.meta.url,
          ),
        ),
      },
    });
    recipe.createPage().text("x", 72, 72).endPage().bookmark("One", 1);
    assert.deepEqual(readOutline(recipe.endPDF()).children, [item("One", 1)]);
  });

  it("nests up to 64 levels", function () {
    var nest = (levels) => {
      var options = {};
      for (var level = levels; level > 1; level--) {
        options = { children: [{ title: "t", pageNumber: 1, ...options }] };
      }
      return options;
    };
    var recipe = new Recipe();
    recipe.createPage().endPage().bookmark("t", 1, nest(64));
    assert.throws(
      () => recipe.bookmark("t", 1, nest(65)),
      new RangeError("Bookmarks can nest at most 64 levels"),
    );
    recipe.endPDF();
  });

  it("throws after endPDF", function () {
    var recipe = new Recipe();
    recipe.createPage().endPage().endPDF();
    assert.throws(
      () => recipe.bookmark("One", 1),
      new Error("PDF writer has ended"),
    );
  });

  it("works with annotations and PDF/A", function () {
    var recipe = new Recipe({
      pdfa: {
        level: Recipe.PdfA.A3B,
        iccProfile: readFileSync(
          new URL(
            "../../../native-with-source/tests/TestMaterials/icc/sRGB-v2-micro.icc",
            import.meta.url,
          ),
        ),
      },
    });
    recipe
      .createPage()
      .text("x", 72, 72)
      .comment("note", 72, 100)
      .endPage()
      .attach("a", new TextEncoder().encode("x"))
      .bookmark("One", 1);
    assert.deepEqual(readOutline(recipe.endPDF()).children, [item("One", 1)]);
  });

  it("keeps the outline pass out of the metadata of PDF/A files", function () {
    var iccProfile = readFileSync(
      new URL(
        "../../../native-with-source/tests/TestMaterials/icc/sRGB-v2-micro.icc",
        import.meta.url,
      ),
    );
    [Recipe.PdfA.A3B, Recipe.PdfA.A4].forEach((level) => {
      var recipe = new Recipe({ pdfa: { level, iccProfile } });
      recipe.createPage().text("x", 72, 72).endPage().bookmark("One", 1);
      var bytes = recipe.endPDF();
      assert.deepEqual(readOutline(bytes).children, [item("One", 1)]);
      var text = Buffer.from(bytes).toString("latin1");
      // one XMP packet, with the date the Info dictionary of the pass over
      // the finished file still has, if the level has an Info dictionary
      var xmp = [...text.matchAll(/<xmp:ModifyDate>([^<]*)</g)].map(
        (match) => match[1],
      );
      assert.equal(xmp.length, 1);
      var infos = [...text.matchAll(/\/ModDate ?\(D:(\d{14})/g)].map(
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
