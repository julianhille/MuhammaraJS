import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm, createRecipe } from "../../index.js";

/** Decodes page streams for structural border assertions. */
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

/** Counts line paths independently of text and rectangles. */
function lineCount(content) {
  return (content.match(/ m\b/g) || []).length;
}

describe("Recipe table layout", function () {
  var Recipe;
  var muhammara;
  var reader;

  before(async function () {
    Recipe = await createRecipe();
    Recipe.registerFont(
      "arial",
      new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/fonts/arial.ttf",
            import.meta.url,
          ),
        ),
      ),
    );
    muhammara = await createMuhammaraWasm();
  });

  afterEach(function () {
    if (reader) reader.end();
    reader = undefined;
  });

  /** Finalizes the output and opens the reader owned by this test. */
  function finish(recipe) {
    reader = muhammara.createReader(recipe.endPage().endPDF());
    return reader;
  }

  /** Extracts text and PDF-space positions from a generated page. */
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

  it("rejects a null record like native Recipe", function () {
    var recipe = new Recipe().createPage(400, 400);
    assert.throws(
      () => recipe.table(20, 20, [{ a: "A1" }, null], {}),
      TypeError,
    );
    finish(recipe);
  });

  it("renders nullish values as empty cells and keeps other values", function () {
    var recipe = new Recipe().createPage(400, 400);
    var values = [];
    recipe.table(20, 20, [{ a: null, b: undefined, c: 0, d: false }, {}], {
      columns: ["a", "b", "c", "d"].map((name) => ({
        name,
        /** Records the normalized value without modifying the cell. */
        renderer: (text) => {
          values.push(text);
        },
      })),
    });
    finish(recipe);
    var content = texts().map((entry) => entry.content);
    assert.deepEqual(content, ["0", "false"]);
    assert.deepEqual(values, ["", "", 0, false, "", "", "", ""]);
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
      /** Continues on a taller page with the Recipe as the callback receiver. */
      overflow: function (self) {
        assert.equal(this, self);
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

  it("preserves exact field names in an order array", function () {
    var recipe = new Recipe().createPage(400, 400);
    recipe.table(20, 20, [{ " a ": "spaced", "": "empty", a: "wrong" }], {
      order: [" a ", ""],
    });
    finish(recipe);
    assert.deepEqual(
      texts().map((entry) => entry.content),
      ["spaced", "empty"],
    );
  });

  it("leaves tables with no columns unchanged", function () {
    var recipe = new Recipe().createPage(400, 400);
    recipe.table(40, 20, [{ a: "before" }]);
    var before = recipe.movedown(0, true);
    recipe.table(150, 150, [{}, {}], { header: true, border: true });
    var after = recipe.movedown(0, true);
    finish(recipe);
    assert.deepEqual(after, before);
    assert.deepEqual(
      texts().map((entry) => entry.content),
      ["before"],
    );
  });

  it("includes vertical padding in row heights and overflow decisions", function () {
    var recipe = new Recipe().createPage(400, 400);
    var overflowRows = [];
    recipe.table(20, 20, [{ a: "first" }, { a: "second" }], {
      size: 8,
      height: 40,
      columns: [{ name: "a", cell: { lineHeight: 10, padding: [7, 2, 9, 2] } }],
      /** Moves the second row into a separate bounded segment. */
      overflow: (self, row) => {
        overflowRows.push(row);
        return { position: [180, 100] };
      },
    });
    var cursor = recipe.movedown(0, true);
    finish(recipe);
    assert.deepEqual(overflowRows, [2]);
    assert.deepEqual(cursor, [180, 126]);
    assert.ok(texts().find((entry) => entry.content === "second").x >= 180);
  });

  ["minHeight", "height"].forEach(function (heightOption) {
    it(`sizes headers and renderer cells with textBox.${heightOption}`, function () {
      var recipe = new Recipe().createPage(400, 400);
      var calls = [];
      recipe.table(20, 20, [{ a: "first" }, { a: "second" }], {
        header: true,
        columns: [
          {
            name: "a",
            hcell: { [heightOption]: 60 },
            /** Gives the first data row a larger box than its text needs. */
            renderer: (text, record, field, row) => {
              calls.push(row);
              return { textBox: { [heightOption]: row === 1 ? 80 : 40 } };
            },
          },
        ],
      });
      var cursor = recipe.movedown(0, true);
      finish(recipe);
      assert.deepEqual(calls, [1, 2]);
      assert.deepEqual(cursor, [20, 200]);
      var entries = texts();
      var first = entries.find((entry) => entry.content === "first");
      var second = entries.find((entry) => entry.content === "second");
      assert.ok(Math.abs(first.y - second.y - 80) < 0.001);
    });
  });

  it("measures HTML line breaks as rendered content", function () {
    var recipe = new Recipe().createPage(400, 400);
    recipe.table(
      20,
      20,
      [{ a: "one<br>two<br>three<br>four" }, { a: "after" }],
      {
        html: true,
        size: 8,
        columns: [
          { name: "a", width: 350, cell: { lineHeight: 12, padding: 0 } },
        ],
      },
    );
    var cursor = recipe.movedown(0, true);
    finish(recipe);
    var entries = texts();
    assert.ok(
      entries.find((entry) => entry.content === "four").y >
        entries.find((entry) => entry.content === "after").y,
    );
    assert.deepEqual(cursor, [20, 80]);
  });

  it("finishes borders only once when overflow stops the table", function () {
    var recipe = new Recipe().createPage(400, 400);
    var overflowRows = [];
    recipe.table(
      20,
      20,
      [
        { a: "first", b: "cell" },
        { a: "omitted", b: "row" },
      ],
      {
        size: 8,
        height: 15,
        border: { opacity: 0.5 },
        row: { cell: { lineHeight: 10, padding: 0 } },
        /** Stops after the first complete row. */
        overflow: (self, row) => {
          overflowRows.push(row);
          return true;
        },
      },
    );
    var cursor = recipe.movedown(0, true);
    finish(recipe);
    assert.deepEqual(overflowRows, [2]);
    assert.deepEqual(cursor, [20, 30]);
    assert.deepEqual(
      texts().map((entry) => entry.content),
      ["first", "cell"],
    );
    assert.equal(lineCount(pageContent(muhammara, reader, 0)), 1);
  });

  it("rejects a continuation without room for its header and first row", function () {
    var recipe = new Recipe().createPage(400, 400);
    var calls = 0;
    assert.throws(
      () =>
        recipe.table(20, 390, [{ a: "omitted" }], {
          header: { cell: { minHeight: 40 } },
          row: { cell: { minHeight: 40 } },
          /** Returns an area where the row alone fits, but its header does not. */
          overflow: (self) => {
            calls++;
            self.endPage().createPage(400, 300);
            return { position: [20, 180] };
          },
        }),
      {
        name: "RangeError",
        message:
          "Recipe.table: row 1 and its header do not fit in the continuation area.",
      },
    );
    recipe.text("recovered", 20, 20);
    finish(recipe);
    assert.equal(
      calls,
      1,
      "does not repeatedly create pages for an oversized row",
    );
    assert.deepEqual(
      texts(1).map((entry) => entry.content),
      ["recovered"],
    );
  });

  [true, false].forEach(function (columnHeader) {
    it(`isolates default headers from body styles with column.header=${columnHeader}`, function () {
      var recipe = new Recipe().createPage(400, 400);
      recipe.text("control", 20, 10, { bold: true });
      recipe.table(20, 50, [{ value: "body" }], {
        header: true,
        font: "arial",
        size: 30,
        color: "red",
        textBox: { lineHeight: 60 },
        columns: [
          {
            name: "value",
            text: "Header",
            width: 250,
            header: columnHeader,
            font: "arial",
            size: 24,
            bold: false,
            cell: { padding: 20, textAlign: "right top" },
          },
        ],
      });
      finish(recipe);
      var entries = reader.extractPageText(0);
      var control = entries.find((entry) => entry.content === "control");
      var header = entries.find((entry) => entry.content === "Header");
      var body = entries.find((entry) => entry.content === "body");
      assert.equal(header.fontSize, 14);
      assert.equal(header.fontResource, control.fontResource);
      assert.equal(body.fontSize, 24);
      assert.notEqual(body.fontResource, header.fontResource);
      assert.ok(header.textMatrix[4] < body.textMatrix[4]);
    });
  });

  it("lets explicit table header styles override column headers and body styles", function () {
    var recipe = new Recipe().createPage(400, 400);
    recipe.table(20, 20, [{ value: "body" }], {
      size: 30,
      color: "red",
      header: { font: "arial", size: 12, color: "blue" },
      columns: [
        {
          name: "value",
          text: "Header",
          width: 250,
          size: 24,
          color: "red",
          header: { size: 18, color: "green" },
        },
      ],
    });
    finish(recipe);
    assert.deepEqual(
      reader.extractPageText(0).map((entry) => [entry.content, entry.fontSize]),
      [
        ["Header", 12],
        ["body", 24],
      ],
    );
    var content = pageContent(muhammara, reader, 0);
    assert.match(content, /\b0\s+0\s+1\s+rg\b/);
    assert.match(content, /\b1\s+0\s+0\s+rg\b/);
  });

  it("merges header box overrides and uses the same styles on continuations", function () {
    var recipe = new Recipe().createPage(400, 400);
    var headerCalls = [];
    var writeText = recipe.text;
    /** Captures effective box styling alongside assertions on the produced PDF. */
    recipe.text = function (text, x, y, options) {
      if (text === "Header")
        headerCalls.push(JSON.parse(JSON.stringify(options)));
      return writeText.call(this, text, x, y, options);
    };
    var options = {
      size: 8,
      height: 70,
      header: {
        size: 12,
        alignToData: true,
        textBox: { minHeight: 200 },
        cell: { padding: 3, minHeight: 40, style: { fill: "#eeeeee" } },
      },
      columns: [
        {
          name: "value",
          text: "Header",
          width: 120,
          size: 8,
          header: {
            size: 18,
            textBox: { style: { opacity: 0.4, lineWidth: 2 } },
          },
          cell: { padding: 0, lineHeight: 10, textAlign: "right top" },
          hcell: {
            padding: [5, 6],
            minHeight: 50,
            textAlign: "left top",
            style: { stroke: "blue" },
          },
        },
      ],
      /** Continues the final row in a second bounded area on the same page. */
      overflow: () => ({ position: [200, 200] }),
    };
    var before = JSON.stringify(options);
    recipe.table(
      20,
      20,
      [{ value: "row1" }, { value: "row2" }, { value: "row3" }],
      options,
    );
    var cursor = recipe.movedown(0, true);
    finish(recipe);
    assert.equal(
      JSON.stringify(options),
      before,
      "does not mutate header options",
    );
    assert.equal(headerCalls.length, 2);
    headerCalls.forEach((header) => {
      assert.equal(header.size, 12);
      assert.deepEqual(header.textBox.padding, [5, 6]);
      assert.equal(header.textBox.textAlign, "left top");
      assert.deepEqual(header.textBox.style, {
        opacity: 0.4,
        lineWidth: 2,
        fill: "#eeeeee",
        stroke: "blue",
      });
    });
    assert.deepEqual(cursor, [200, 260]);
    var entries = reader.extractPageText(0);
    assert.deepEqual(
      entries.map((entry) => [entry.content, entry.fontSize]),
      [
        ["Header", 12],
        ["row1", 8],
        ["row2", 8],
        ["Header", 12],
        ["row3", 8],
      ],
    );
    assert.ok(entries[3].textMatrix[5] > entries[4].textMatrix[5]);
  });

  it("uses a column's cell as its only body text box", function () {
    var recipe = new Recipe().createPage(400, 400);
    recipe.table(20, 20, [{ a: "first" }], {
      size: 8,
      columns: [
        {
          name: "a",
          textBox: { minHeight: 60 },
          cell: { lineHeight: 10, padding: 3 },
        },
      ],
    });
    var cursor = recipe.movedown(0, true);
    finish(recipe);
    assert.deepEqual(cursor, [20, 36]);
  });

  it("ignores a table-level cell like native Recipe", function () {
    var recipe = new Recipe().createPage(400, 400);
    recipe.table(20, 20, [{ a: "first" }], {
      size: 8,
      cell: { minHeight: 60 },
      columns: [{ name: "a", cell: { lineHeight: 10, padding: 3 } }],
    });
    var cursor = recipe.movedown(0, true);
    finish(recipe);
    assert.deepEqual(cursor, [20, 36]);
  });

  it("lets a row cell replace the row's textBox", function () {
    var recipe = new Recipe().createPage(400, 400);
    recipe.table(20, 20, [{ a: "first" }], {
      size: 8,
      columns: [{ name: "a", cell: { lineHeight: 10, padding: 3 } }],
      row: { textBox: { padding: 20 }, cell: { minHeight: 30 } },
    });
    var cursor = recipe.movedown(0, true);
    finish(recipe);
    assert.deepEqual(cursor, [20, 50]);
  });

  it("merges nested column and row cell styles", function () {
    var recipe = new Recipe().createPage(400, 400);
    recipe.table(20, 20, [{ a: "first" }], {
      size: 8,
      columns: [
        {
          name: "a",
          cell: { lineHeight: 10, style: { fill: "#ff0000" } },
        },
      ],
      row: { cell: { style: { stroke: "#0000ff" } } },
    });
    finish(recipe);
    var content = pageContent(muhammara, reader, 0);
    assert.match(content, /(^|\s)1 0 0 rg\b/, "the column fill survives");
    assert.match(content, /(^|\s)0 0 1 RG\b/, "the row stroke applies");
  });

  it("merges renderer box styles over column and row styles", function () {
    var recipe = new Recipe().createPage(400, 400);
    recipe.table(20, 20, [{ a: "first" }], {
      columns: [
        {
          name: "a",
          cell: { lineHeight: 10, style: { fill: "#ff0000" } },
          /** Overrides only the stroke; the column fill must survive. */
          renderer: () => ({ textBox: { style: { stroke: "#00ff00" } } }),
        },
      ],
      row: { cell: { style: { stroke: "#0000ff" } } },
    });
    finish(recipe);
    var content = pageContent(muhammara, reader, 0);
    assert.match(content, /(^|\s)1 0 0 rg\b/, "the column fill survives");
    assert.match(content, /(^|\s)0 1 0 RG\b/, "the renderer stroke applies");
    assert.doesNotMatch(
      content,
      /(^|\s)0 0 1 RG\b/,
      "the row stroke is replaced",
    );
  });

  it("replaces arrays such as padding instead of merging their entries", function () {
    var recipe = new Recipe().createPage(400, 400);
    recipe.table(20, 20, [{ a: "first" }], {
      size: 8,
      columns: [
        { name: "a", cell: { lineHeight: 10, padding: [10, 2, 10, 2] } },
      ],
      row: { cell: { padding: [3] } },
    });
    var cursor = recipe.movedown(0, true);
    finish(recipe);
    // [3] pads every side by 3; merging entries would keep the 10pt bottom.
    assert.deepEqual(cursor, [20, 36]);
  });
});
