import assert from "node:assert/strict";
import { createMuhammaraWasm, createRecipe } from "../../index.js";

function pageContent(muhammara, reader, pageIndex) {
  var page = reader.parsePage(pageIndex).getDictionary();
  var contents = reader.queryDictionaryObject(page, "Contents");
  var streams =
    contents.getType() === muhammara.ePDFObjectArray
      ? contents
          .toPDFArray()
          .toJSArray()
          .map((reference) =>
            reader.parseNewObject(
              reference.toPDFIndirectObjectReference().getObjectID(),
            ),
          )
      : [contents];
  return streams
    .map((stream) => {
      var input = reader.startReadingFromStream(stream.toPDFStream());
      var bytes = [];
      while (input.notEnded()) bytes.push(...input.read(4096));
      return new TextDecoder("latin1").decode(new Uint8Array(bytes));
    })
    .join("\n");
}

function lineCount(content) {
  return (content.match(/ m\b/g) || []).length;
}

describe("Recipe table layout", function () {
  var Recipe;
  var muhammara;
  var reader;

  before(async function () {
    Recipe = await createRecipe();
    muhammara = await createMuhammaraWasm();
  });

  afterEach(function () {
    if (reader) reader.end();
    reader = undefined;
  });

  function finish(recipe) {
    reader = muhammara.createReader(recipe.endPage().endPDF());
    return reader;
  }

  function texts(pageIndex = 0) {
    return reader.extractPageText(pageIndex).map((entry) => ({
      content: entry.content,
      x: entry.textMatrix[4],
      y: entry.textMatrix[5],
    }));
  }

  it("includes fields from every record and explicit optional columns", function () {
    var recipe = new Recipe().createPage(400, 400);
    recipe
      .table(20, 20, [{ a: "A1" }, { a: "A2", b: "B2" }], { header: true })
      .table(20, 120, [{ a: "A3" }], {
        header: true,
        columns: [{ name: "a" }, { name: "note", text: "Note" }],
      })
      .table(20, 220, [{ a: "A4", b: "B4" }], { header: true, order: "b, a" });
    finish(recipe);
    var entries = texts();
    var content = entries.map((entry) => entry.content);
    assert.ok(content.includes("B2"), "a field missing from the first row");
    assert.ok(content.includes("Note"), "an explicit optional column");
    var ordered = entries.filter((entry) => entry.y < 200);
    var b = ordered.find((entry) => entry.content === "b");
    var a = ordered.find((entry) => entry.content === "a");
    assert.ok(b.x < a.x, "order places b before a");
  });

  it("renders nullish values as empty cells and keeps other values", function () {
    var recipe = new Recipe().createPage(400, 400);
    recipe.table(20, 20, [{ a: null, b: undefined, c: 0, d: false }]);
    finish(recipe);
    var content = texts().map((entry) => entry.content);
    assert.deepEqual(content, ["0", "false"]);
  });

  it("runs each renderer once per cell and sizes rows with its options", function () {
    var calls = [];
    var recipe = new Recipe().createPage(400, 400);
    recipe
      .table(20, 20, [{ a: "x" }, { a: "y" }])
      .table(200, 20, [{ b: "x" }, { b: "z" }], {
        columns: [
          {
            name: "b",
            renderer: (text, record, field, row) => {
              calls.push([text, field, row]);
              return row === 1 ? { size: 30 } : null;
            },
          },
        ],
      });
    finish(recipe);
    assert.deepEqual(calls, [
      ["x", "b", 1],
      ["z", "b", 2],
    ]);
    var entries = texts();
    var control = entries.find((entry) => entry.content === "y");
    var rendered = entries.find((entry) => entry.content === "z");
    assert.ok(
      control.y - rendered.y > 10,
      "the renderer's larger size grows its row",
    );
  });

  it("continues with each position's own bounds and a repeated header", function () {
    var overflows = 0;
    var rows = Array.from({ length: 30 }, (_, index) => ({
      name: `row ${index + 1}`,
    }));
    var recipe = new Recipe().createPage(300, 300);
    recipe.table(20, 20, rows, {
      header: true,
      overflow: (self) => {
        overflows += 1;
        self.endPage().createPage(300, 800);
        return { position: [20, 20] };
      },
    });
    recipe.table(20, 700, [{ name: "later table" }]);
    finish(recipe);
    assert.equal(overflows, 1, "a later table does not reuse the callback");
    var first = texts(0).map((entry) => entry.content);
    var second = texts(1).map((entry) => entry.content);
    assert.equal(first.filter((content) => content === "name").length, 1);
    assert.equal(second.filter((content) => content === "name").length, 1);
    assert.deepEqual(
      [...first, ...second].filter((content) => /^row /.test(content)),
      rows.map((row) => row.name),
    );
    assert.ok(second.includes("later table"));
  });

  it("draws each border line once, keeps its options, and skips empty segments", function () {
    var data = [
      { a: "A1", b: "B1" },
      { a: "A2", b: "B2" },
    ];
    var border = { dash: [3, 2] };
    var recipe = new Recipe().createPage(300, 300);
    recipe.table(20, 20, data, { header: true, border });
    recipe.endPage().createPage(300, 300);
    recipe.table(20, 290, data, {
      header: true,
      border,
      overflow: () => ({ position: [20, 20] }),
    });
    finish(recipe);
    [0, 1].forEach((pageIndex) => {
      var content = pageContent(muhammara, reader, pageIndex);
      // One column divider plus the header and first-row separators.
      assert.equal(lineCount(content), 3);
      assert.match(content, /\[\s*3\s+2\s*\]\s*0\s+d/);
      // Wasm strokes the outer rectangle in the page content as well, so it
      // must carry the same dash. Native draws it through a form XObject.
      assert.equal(
        (content.match(/\[\s*3\s+2\s*\]\s*0\s+d/g) || []).length,
        lineCount(content) + 1,
      );
    });
    assert.deepEqual(
      border,
      { dash: [3, 2] },
      "border options are not mutated",
    );
  });

  it("returns for empty contents and leaves the cursor below the table", function () {
    var recipe = new Recipe().createPage(400, 400);
    assert.equal(recipe.table(20, 20, []), recipe);
    recipe.table(40, 20, [{ a: "A" }, { a: "B" }]);
    var [x, y] = recipe.movedown(0, true);
    finish(recipe);
    var last = texts().find((entry) => entry.content === "B");
    assert.equal(x, 40);
    assert.ok(y > 400 - last.y, "the cursor is below the last row");
  });
});
