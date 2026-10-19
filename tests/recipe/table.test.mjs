import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeEnds, fixture, writeOutput } from "../support/ends.mjs";
import { drawnContent, pageCount } from "../support/pdf.mjs";
import { extractedText, lineCount } from "../support/tables.mjs";

/**
 * Sort people by last name, ignoring case.
 * @param {object} a - A person.
 * @param {object} b - Another person.
 * @returns {number} The sort order.
 */
function compare(a, b) {
  var nameA = a.last_name.toUpperCase();
  var nameB = b.last_name.toUpperCase();
  return nameA > nameB ? 1 : nameA < nameB ? -1 : 0;
}

/**
 * Colour the name cells of female records.
 * @param {string} text - The cell text.
 * @param {object} record - The record.
 * @returns {object|undefined} The cell options.
 */
function hilight(text, record) {
  if (record.gender.toLowerCase() === "female") {
    return { color: "#ff1493" };
  }
}

/**
 * Text runs with their content and PDF-space position.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {Array<{content: string, x: number, y: number}>} The runs.
 */
function texts(end, bytes, pageIndex = 0) {
  return extractedText(end, bytes, pageIndex).map((run) => ({
    content: run.content,
    x: run.textMatrix[4],
    y: run.textMatrix[5],
  }));
}

describeEnds("Recipe table", function (end) {
  var outputName;

  beforeEach(function () {
    outputName =
      "table-" +
      this.currentTest.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
  });

  /**
   * Finish the Recipe and keep its output for review.
   * @param {object} recipe - The Recipe with an open page.
   * @returns {Uint8Array} The PDF.
   */
  function finish(recipe) {
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, outputName, bytes);
    return bytes;
  }

  it("binds table overflow callbacks to the Recipe", function () {
    var recipe = end.newRecipe();
    var calls = 0;
    recipe.createPage(300, 300).table(10, 10, [{ value: "row" }], {
      height: 1,
      overflow: function (currentRecipe, row) {
        calls += 1;
        assert.equal(this, recipe);
        assert.equal(currentRecipe, recipe);
        assert.equal(row, 1);
        return true;
      },
    });
    finish(recipe);
    assert.equal(calls, 1);
  });

  it("draws tables with alternating rows, overflow and fewer columns", function () {
    var people = JSON.parse(
      readFileSync(fixture("recipe/people.json"), "utf8"),
    );
    var contents = [
      {
        name: "Steven Haehn",
        address: "257 Banana Ave.",
        city: "Colorado Springs",
        state: "Colorado",
        job: "computer programmer",
      },
      {
        name: "Yunjin Kim",
        address: "123 Laurel Blvd.",
        city: "Phoenix",
        state: "Arizona",
        job: "musical director, teacher",
      },
      {
        name: "Chunyen Huang",
        address: "34178 Sunset Lane",
        city: "Los Angles",
        state: "California",
        job: "computer analyst",
      },
      {
        name: "Iris Johansen",
        address: "341 Washington Ave.",
        city: "Atlanta",
        state: "Georgia",
        job: "author",
      },
      {
        name: "Terry Brooks",
        address: "1523 Bernard Blvd.",
        state: "Oregon",
        job: "author",
      },
      {
        name: "Joy Merchand",
        address: "46 Medulla Lane",
        city: "San Jose",
        state: "California",
        job: "psycologist",
      },
    ];
    var pcols = [
      { name: "email", width: 170 },
      { name: "ip_address", width: 110 },
      { name: "first_name", renderer: hilight, width: 80 },
      { name: "last_name", renderer: hilight, width: 80 },
    ];
    var columns = [
      {
        text: "Name",
        name: "name",
        width: 110,
        cell: { textAlign: "center center" },
      },
      {
        text: "Address",
        name: "address",
        width: 130,
        cell: { textAlign: "left center" },
      },
      {
        text: "City/Town",
        name: "city",
        width: 100,
        cell: { textAlign: "center center" },
      },
      { text: "State", name: "state", width: 80 },
      {
        text: "Occupation",
        name: "job",
        width: 100,
        color: "red",
        size: 10,
        cell: { textAlign: "right bottom" },
        hcell: { textAlign: "center center" },
      },
    ];
    var newPage = (self) => {
      self.endPage();
      self.createPage("letter");
      return { position: [30, 52] };
    };
    var nextTable = 30;
    var samePage = () => {
      nextTable += 170;
      if (nextTable > 500) return true;
      return { position: [nextTable, 302] };
    };
    var x = 50;
    var y = 52;
    var recipe = end
      .newRecipe()
      .createPage("letter")
      .text("Table with alternating row properties", 230, 30, {
        color: "#000000",
      })
      .table(x, y, contents, {
        columns,
        header: {
          alignToData: true,
          cell: { padding: [8, 2, 8, 2], textAlign: "left" },
        },
        border: { stroke: "#dddddd" },
        row: { nth: "odd", cell: { style: { fill: "#dddddd" } } },
      })
      .text(
        'Tables showing new position when "overflow" encountered.',
        80,
        y + 200,
        { color: "#000000" },
      )
      .text("Note data driven property (color) assignment", 130, y + 220, {
        size: 12,
        color: "#000000",
      })
      .table(x - 20, y + 250, people.sort(compare), {
        columns: pcols,
        border: true,
        header: { cell: { textAlign: "left" } },
        row: { size: 10 },
        overflow: samePage,
        order: "first_name,last_name",
      })
      .endPage()
      .createPage("letter")
      .text(
        "Table continued onto subsequent pages (overflow encountered)",
        x,
        y - 30,
        { color: "#000000" },
      )
      .table(x - 20, y, people.sort(compare), {
        columns: pcols,
        border: true,
        header: true,
        row: { size: 10 },
        overflow: newPage,
        order: "first_name,last_name,email",
      })
      .endPage()
      .createPage("letter")
      .text("Table with less columns than fields in data", 230, 30, {
        color: "#000000",
      })
      .table(x, y, contents, {
        columns: columns.slice(0, 4),
        header: {
          alignToData: true,
          cell: { padding: [8, 2, 8, 2], textAlign: "left" },
        },
        border: { stroke: "#dddddd" },
        row: { size: 10 },
      });
    var bytes = finish(recipe);
    var pages = pageCount(end, bytes);
    assert.ok(pages >= 4, "the second people table continues on new pages");
    var first = texts(end, bytes, 0).map((entry) => entry.content);
    assert.ok(first.includes("Steven Haehn"));
    assert.ok(first.includes("Occupation"));
    var last = texts(end, bytes, pages - 1).map((entry) => entry.content);
    assert.ok(last.includes("Joy Merchand"));
    assert.ok(!last.includes("psycologist"), "the job column is left out");
  }).timeout(60000);

  it("includes fields from every record and explicit optional columns", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    recipe
      .table(20, 20, [{ a: "A1" }, { a: "A2", b: "B2" }], { header: true })
      .table(20, 120, [{ a: "A3" }], {
        header: true,
        columns: [{ name: "a" }, { name: "note", text: "Note" }],
      })
      .table(20, 220, [{ a: "A4", b: "B4" }], { header: true, order: "b, a" });
    var entries = texts(end, finish(recipe));
    var content = entries.map((entry) => entry.content);
    assert.ok(content.includes("B2"), "a field missing from the first row");
    assert.ok(content.includes("Note"), "an explicit optional column");
    var ordered = entries.filter((entry) => entry.y < 200);
    var b = ordered.find((entry) => entry.content === "b");
    var a = ordered.find((entry) => entry.content === "a");
    assert.ok(b.x < a.x, "order places b before a");
  });

  it("rejects a null record", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    assert.throws(
      () => recipe.table(20, 20, [{ a: "A1" }, null], {}),
      TypeError,
    );
    finish(recipe);
  });

  it("renders nullish values as empty cells and keeps other values", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    var values = [];
    recipe.table(20, 20, [{ a: null, b: undefined, c: 0, d: false }, {}], {
      columns: ["a", "b", "c", "d"].map((name) => ({
        name,
        /**
         * Record the normalized value without changing the cell.
         * @param {*} text - The cell value.
         * @returns {void}
         */
        renderer: (text) => {
          values.push(text);
        },
      })),
    });
    var content = texts(end, finish(recipe)).map((entry) => entry.content);
    assert.deepEqual(content, ["0", "false"]);
    assert.deepEqual(values, ["", "", 0, false, "", "", "", ""]);
  });

  it("runs each renderer once per cell and sizes rows with its options", function () {
    var calls = [];
    var recipe = end.newRecipe().createPage(400, 400);
    recipe
      .table(20, 20, [{ a: "x" }, { a: "y" }], { font: "arial" })
      .table(200, 20, [{ b: "x" }, { b: "z" }], {
        font: "arial",
        columns: [
          {
            name: "b",
            renderer: (text, record, field, row) => {
              calls.push([text, field, row]);
              return row === 1 ? { size: 30 } : null;
            },
          },
        ],
      })
      // Rows are resolved one at a time: an overflow that ends the table
      // runs before the renderer of a row that is never drawn.
      .table(
        20,
        300,
        Array.from({ length: 6 }, (_, index) => ({ c: "row" + index })),
        {
          size: 30,
          columns: [
            {
              name: "c",
              renderer: (text, record, field, row) => {
                calls.push(["render", row]);
              },
            },
          ],
          overflow: (self, row) => {
            calls.push(["overflow", row]);
            return true;
          },
        },
      );
    var entries = texts(end, finish(recipe));
    assert.deepEqual(calls, [
      ["x", "b", 1],
      ["z", "b", 2],
      ["render", 1],
      ["overflow", 1],
    ]);
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
    var recipe = end.newRecipe().createPage(300, 300);
    recipe.table(20, 20, rows, {
      header: true,
      font: "arial",
      /**
       * Continue on a taller page with the Recipe as the callback receiver.
       * @param {object} self - The Recipe.
       * @returns {object} The continuation position.
       */
      overflow: function (self) {
        assert.equal(this, self);
        overflows += 1;
        self.endPage().createPage(300, 800);
        return { position: [20, 20] };
      },
    });
    recipe.table(20, 700, [{ name: "later table" }]);
    var bytes = finish(recipe);
    assert.equal(overflows, 1, "a later table does not reuse the callback");
    var first = texts(end, bytes, 0).map((entry) => entry.content);
    var second = texts(end, bytes, 1).map((entry) => entry.content);
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
    var recipe = end.newRecipe().createPage(300, 300);
    recipe.table(20, 20, data, { header: true, border, font: "arial" });
    recipe.endPage().createPage(300, 300);
    recipe.table(20, 290, data, {
      header: true,
      border,
      font: "arial",
      overflow: () => ({ position: [20, 20] }),
    });
    var bytes = finish(recipe);
    [0, 1].forEach((pageIndex) => {
      var content = drawnContent(end, bytes, pageIndex);
      // One column divider plus the header and first-row separators.
      assert.equal(lineCount(content), 3);
      // The outer rectangle carries the same dash as the lines.
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
    var recipe = end.newRecipe().createPage(400, 400);
    assert.equal(recipe.table(20, 20, []), recipe);
    recipe.table(40, 20, [{ a: "A" }, { a: "B" }], { font: "arial" });
    var [x, y] = recipe.movedown(0, true);
    var last = texts(end, finish(recipe)).find(
      (entry) => entry.content === "B",
    );
    assert.equal(x, 40);
    assert.ok(y > 400 - last.y, "the cursor is below the last row");
  });

  it("preserves exact field names in an order array", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    recipe.table(20, 20, [{ " a ": "spaced", "": "empty", a: "wrong" }], {
      order: [" a ", ""],
    });
    assert.deepEqual(
      texts(end, finish(recipe)).map((entry) => entry.content),
      ["spaced", "empty"],
    );
  });

  it("leaves tables with no columns unchanged", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    recipe.table(40, 20, [{ a: "before" }]);
    var before = recipe.movedown(0, true);
    recipe.table(150, 150, [{}, {}], { header: true, border: true });
    var after = recipe.movedown(0, true);
    var bytes = finish(recipe);
    assert.deepEqual(after, before);
    assert.deepEqual(
      texts(end, bytes).map((entry) => entry.content),
      ["before"],
    );
  });

  it("includes vertical padding in row heights and overflow decisions", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    var overflowRows = [];
    recipe.table(20, 20, [{ a: "first" }, { a: "second" }], {
      size: 8,
      height: 40,
      font: "arial",
      columns: [{ name: "a", cell: { lineHeight: 10, padding: [7, 2, 9, 2] } }],
      /**
       * Move the second row into a separate bounded segment.
       * @param {object} self - The Recipe.
       * @param {number} row - The row that does not fit.
       * @returns {object} The continuation position.
       */
      overflow: (self, row) => {
        overflowRows.push(row);
        return { position: [180, 100] };
      },
    });
    var cursor = recipe.movedown(0, true);
    var bytes = finish(recipe);
    assert.deepEqual(overflowRows, [2]);
    assert.deepEqual(cursor, [180, 126]);
    assert.ok(
      texts(end, bytes).find((entry) => entry.content === "second").x >= 180,
    );
  });

  ["minHeight", "height"].forEach(function (heightOption) {
    it(`sizes headers and renderer cells with textBox.${heightOption}`, function () {
      var recipe = end.newRecipe().createPage(400, 400);
      var calls = [];
      recipe.table(20, 20, [{ a: "first" }, { a: "second" }], {
        header: true,
        font: "arial",
        columns: [
          {
            name: "a",
            hcell: { [heightOption]: 60 },
            /**
             * Give the first data row a larger box than its text needs.
             * @param {string} text - The cell text.
             * @param {object} record - The record.
             * @param {string} field - The field.
             * @param {number} row - The one-based row.
             * @returns {object} The cell options.
             */
            renderer: (text, record, field, row) => {
              calls.push(row);
              return { textBox: { [heightOption]: row === 1 ? 80 : 40 } };
            },
          },
        ],
      });
      var cursor = recipe.movedown(0, true);
      var entries = texts(end, finish(recipe));
      assert.deepEqual(calls, [1, 2]);
      assert.deepEqual(cursor, [20, 200]);
      var first = entries.find((entry) => entry.content === "first");
      var second = entries.find((entry) => entry.content === "second");
      assert.ok(Math.abs(first.y - second.y - 80) < 0.001);
    });
  });

  it("measures HTML line breaks as rendered content", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    recipe.table(
      20,
      20,
      [{ a: "one<br>two<br>three<br>four" }, { a: "after" }],
      {
        html: true,
        size: 8,
        font: "arial",
        columns: [
          { name: "a", width: 350, cell: { lineHeight: 12, padding: 0 } },
        ],
      },
    );
    var cursor = recipe.movedown(0, true);
    var entries = texts(end, finish(recipe));
    assert.ok(
      entries.find((entry) => entry.content === "four").y >
        entries.find((entry) => entry.content === "after").y,
    );
    assert.deepEqual(cursor, [20, 80]);
  });

  it("finishes borders only once when overflow stops the table", function () {
    var recipe = end.newRecipe().createPage(400, 400);
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
        font: "arial",
        border: { opacity: 0.5 },
        row: { cell: { lineHeight: 10, padding: 0 } },
        /**
         * Stop after the first complete row.
         * @param {object} self - The Recipe.
         * @param {number} row - The row that does not fit.
         * @returns {boolean} True to end the table.
         */
        overflow: (self, row) => {
          overflowRows.push(row);
          return true;
        },
      },
    );
    var cursor = recipe.movedown(0, true);
    var bytes = finish(recipe);
    assert.deepEqual(overflowRows, [2]);
    assert.deepEqual(cursor, [20, 30]);
    assert.deepEqual(
      texts(end, bytes).map((entry) => entry.content),
      ["first", "cell"],
    );
    assert.equal(lineCount(drawnContent(end, bytes)), 1);
  });

  it("rejects a continuation after the callback ends the page", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    var calls = 0;
    assert.throws(
      () =>
        recipe.table(20, 20, [{ a: "first" }, { a: "second" }], {
          height: 20,
          /**
           * End the page without starting the next one.
           * @param {object} self - The Recipe.
           * @returns {object} The continuation position.
           */
          overflow: (self) => {
            calls++;
            self.endPage();
            return { position: [20, 20] };
          },
        }),
      {
        name: "Error",
        message:
          "Recipe.table: the overflow callback must leave an active page to continue on.",
      },
    );
    assert.equal(calls, 1);
    writeOutput(end, outputName, recipe.endPDF());
  });

  it("rejects a continuation without room for its header and first row", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    var calls = 0;
    assert.throws(
      () =>
        recipe.table(20, 390, [{ a: "omitted" }], {
          header: { cell: { minHeight: 40 } },
          row: { cell: { minHeight: 40 } },
          /**
           * Return an area where the row alone fits, but its header does not.
           * @param {object} self - The Recipe.
           * @returns {object} The continuation position.
           */
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
    var bytes = finish(recipe);
    assert.equal(
      calls,
      1,
      "does not repeatedly create pages for an oversized row",
    );
    assert.deepEqual(
      texts(end, bytes, 1).map((entry) => entry.content),
      ["recovered"],
    );
  });

  [true, false].forEach(function (columnHeader) {
    it(`isolates default headers from body styles with column.header=${columnHeader}`, function () {
      var recipe = end.newRecipe().createPage(400, 400);
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
      var entries = extractedText(end, finish(recipe));
      var control = entries.find((entry) => entry.content === "control");
      var header = entries.find((entry) => entry.content === "Header");
      var body = entries.find((entry) => entry.content === "body");
      // The default header is the default bold font at 14pt.
      assert.equal(header.fontSize, 14);
      assert.equal(header.fontResource, control.fontResource);
      assert.equal(body.fontSize, 24);
      assert.notEqual(body.fontResource, header.fontResource);
      assert.ok(header.textMatrix[4] < body.textMatrix[4]);
    });
  });

  it("lets explicit table header styles override column headers and body styles", function () {
    var recipe = end.newRecipe().createPage(400, 400);
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
    var bytes = finish(recipe);
    assert.deepEqual(
      extractedText(end, bytes).map((entry) => [entry.content, entry.fontSize]),
      [
        ["Header", 12],
        ["body", 24],
      ],
    );
    var content = drawnContent(end, bytes);
    assert.match(content, /(^|\s)0\s+0\s+1\s+rg\b/);
    assert.match(content, /(^|\s)1\s+0\s+0\s+rg\b/);
  });

  it("treats inherited prototype properties as missing cells", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    var records = [
      {},
      { constructor: "ctor", toString: "string", hasOwnProperty: "own" },
    ];
    var values = [];
    recipe.table(20, 20, records);
    recipe.table(20, 200, records, {
      columns: ["constructor", "toString", "hasOwnProperty"].map((name) => ({
        name,
        /**
         * Record normalized values for missing fields and shadowed built-ins.
         * @param {*} text - The cell value.
         * @returns {void}
         */
        renderer: (text) => {
          values.push(text);
        },
      })),
    });
    var bytes = finish(recipe);
    assert.deepEqual(values, ["", "", "", "ctor", "string", "own"]);
    assert.deepEqual(
      texts(end, bytes).map((entry) => entry.content),
      ["ctor", "string", "own", "ctor", "string", "own"],
    );
  });

  ["table", "column", "row", "header", "column-header", "hcell"].forEach(
    function (scope) {
      it(`preserves ${scope} onClip callbacks when resolving table styles`, function () {
        var recipe = end.newRecipe().createPage(400, 400);
        var clips = [];
        var box = {
          height: 14,
          lineHeight: 10,
          padding: 2,
          clipIfExceedsBox: true,
          /**
           * Report the clipped line through a declaratively configured callback.
           * @param {object} self - The Recipe.
           * @param {object} result - The clip result.
           * @returns {void}
           */
          onClip: (self, result) => {
            clips.push(result);
          },
        };
        var column = { name: "value" };
        var options = { size: 8, font: "arial", columns: [column] };
        var header = ["header", "column-header", "hcell"].includes(scope);
        if (scope === "table") options.textBox = box;
        if (scope === "column") column.cell = box;
        if (scope === "row") options.row = { cell: box };
        if (header) {
          options.header = { size: 8, font: "arial" };
          column.text = "one\ntwo";
          if (scope === "header") options.header.cell = box;
          if (scope === "column-header") column.header = { textBox: box };
          if (scope === "hcell") column.hcell = box;
        }
        recipe.table(
          20,
          20,
          [{ value: header ? "body" : "one\ntwo" }],
          options,
        );
        var bytes = finish(recipe);
        assert.equal(clips.length, 1);
        assert.equal(clips[0].linesWritten, 1);
        assert.ok(clips[0].remainder.includes("two"));
        assert.deepEqual(
          texts(end, bytes).map((entry) => entry.content),
          header ? ["one", "body"] : ["one"],
        );
      });
    },
  );

  it("merges header box overrides and uses the same styles on continuations", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    var options = {
      size: 8,
      height: 70,
      font: "arial",
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
      /**
       * Continue the final row in a second bounded area on the same page.
       * @returns {object} The continuation position.
       */
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
    var bytes = finish(recipe);
    assert.equal(
      JSON.stringify(options),
      before,
      "does not mutate header options",
    );
    assert.deepEqual(cursor, [200, 260]);
    var entries = extractedText(end, bytes);
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
    // Both headers sit left-aligned behind the hcell's 6pt horizontal padding.
    assert.equal(entries[0].textMatrix[4], 26);
    assert.equal(entries[3].textMatrix[4], 206);
    // Both header boxes merge the header cell fill, the hcell stroke and the
    // column header's line width.
    var blocks = drawnContent(end, bytes).split(/\bQ\b/);
    assert.equal(
      blocks.filter(
        (block) =>
          /(^|\s)0\.93\d* 0\.93\d* 0\.93\d* rg\b/.test(block) &&
          /\bre\s+f\b/.test(block),
      ).length,
      2,
      "the header cell fill",
    );
    assert.equal(
      blocks.filter(
        (block) =>
          /(^|\s)0 0 1 RG\b/.test(block) &&
          /(^|\s)2 w\b/.test(block) &&
          /\bre\s+S\b/.test(block),
      ).length,
      2,
      "the hcell stroke with the column header's line width",
    );
  });

  it("uses a column's cell as its only body text box", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    recipe.table(20, 20, [{ a: "first" }], {
      size: 8,
      font: "arial",
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

  it("ignores a table-level cell", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    recipe.table(20, 20, [{ a: "first" }], {
      size: 8,
      font: "arial",
      cell: { minHeight: 60 },
      columns: [{ name: "a", cell: { lineHeight: 10, padding: 3 } }],
    });
    var cursor = recipe.movedown(0, true);
    finish(recipe);
    assert.deepEqual(cursor, [20, 36]);
  });

  it("lets a row cell replace the row's textBox", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    recipe.table(20, 20, [{ a: "first" }], {
      size: 8,
      font: "arial",
      columns: [{ name: "a", cell: { lineHeight: 10, padding: 3 } }],
      row: { textBox: { padding: 20 }, cell: { minHeight: 30 } },
    });
    var cursor = recipe.movedown(0, true);
    finish(recipe);
    assert.deepEqual(cursor, [20, 50]);
  });

  it("merges nested column and row cell styles", function () {
    var recipe = end.newRecipe().createPage(400, 400);
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
    var content = drawnContent(end, finish(recipe));
    assert.match(content, /(^|\s)1 0 0 rg\b/, "the column fill survives");
    assert.match(content, /(^|\s)0 0 1 RG\b/, "the row stroke applies");
  });

  it("merges renderer box styles over column and row styles", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    recipe.table(20, 20, [{ a: "first" }], {
      columns: [
        {
          name: "a",
          cell: { lineHeight: 10, style: { fill: "#ff0000" } },
          /**
           * Override only the stroke; the column fill must survive.
           * @returns {object} The cell options.
           */
          renderer: () => ({ textBox: { style: { stroke: "#00ff00" } } }),
        },
      ],
      row: { cell: { style: { stroke: "#0000ff" } } },
    });
    var content = drawnContent(end, finish(recipe));
    assert.match(content, /(^|\s)1 0 0 rg\b/, "the column fill survives");
    assert.match(content, /(^|\s)0 1 0 RG\b/, "the renderer stroke applies");
    assert.doesNotMatch(
      content,
      /(^|\s)0 0 1 RG\b/,
      "the row stroke is replaced",
    );
  });

  it("replaces arrays such as padding instead of merging their entries", function () {
    var recipe = end.newRecipe().createPage(400, 400);
    recipe.table(20, 20, [{ a: "first" }], {
      size: 8,
      font: "arial",
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

  it("throws the end's no-page error without an active page", function () {
    var recipe = end.newRecipe();
    assert.throws(
      () => recipe.table(10, 10, [{ name: "a" }]),
      end.name === "wasm"
        ? { name: "Error", message: "A page is required for coordinates" }
        : { name: "TypeError", message: /No page is active/ },
    );
    recipe.endPDF();
  });
});
