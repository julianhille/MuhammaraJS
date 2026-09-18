const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const muhammara = require("@muhammara/native-with-source");
const Recipe = muhammara.Recipe;
const fs = require("fs");

function pageContent(reader, pageIndex) {
  const page = reader.parsePage(pageIndex).getDictionary();
  const contents = reader.queryDictionaryObject(page, "Contents");
  const streams =
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
      const input = reader.startReadingFromStream(stream.toPDFStream());
      const bytes = [];
      while (input.notEnded()) bytes.push(...input.read(4096));
      return Buffer.from(bytes).toString("latin1");
    })
    .join("\n");
}

function lineCount(content) {
  return (content.match(/ m\b/g) || []).length;
}

function compare(a, b) {
  // Use toUpperCase() to ignore character casing
  const nameA = a.last_name.toUpperCase();
  const nameB = b.last_name.toUpperCase();

  let comparison = 0;
  if (nameA > nameB) {
    comparison = 1;
  } else if (nameA < nameB) {
    comparison = -1;
  }
  return comparison;
}

function hilight(text, record) {
  if (record.gender.toLowerCase() === "female") {
    return { color: "#ff1493" };
  }
}

describe("Text - Columns", () => {
  it("binds table overflow callbacks to the Recipe", function () {
    var assert = require("node:assert/strict");
    var recipe = new Recipe(
      "new",
      path.join(__dirname, "../output/table-overflow-this.pdf"),
    );
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
    recipe.endPage().endPDF();
    assert.equal(calls, 1);
  });

  it("Table", () => {
    const output = path.join(__dirname, "../output/table.pdf");
    const pplFile = path.join(__dirname, "../TestMaterials/recipe/people.json");
    const recipe = new Recipe("new", output);
    const peeps = fs.readFileSync(pplFile, "utf8");
    const people = JSON.parse(peeps);

    const contents = [
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
        // city: "Seattle",
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

    const pcols = [
      {
        name: "email",
        width: 170,
      },
      {
        name: "ip_address",
        width: 110,
      },
      {
        name: "first_name",
        renderer: hilight,
        width: 80,
      },
      {
        name: "last_name",
        renderer: hilight,
        width: 80,
      },
    ];

    const columns = [
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
      {
        text: "State",
        name: "state",
        width: 80,
      },
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

    // const stop = () => { return true; };

    const newPage = (self) => {
      self.endPage();
      self.createPage("letter");
      return { position: [30, 52] };
    };

    let nextTable = 30;
    const samePage = () => {
      nextTable += 170;
      if (nextTable > 500) {
        return true;
      }
      return { position: [nextTable, 302] };
    };

    let x = 50;
    let y = 52;
    recipe
      .createPage("letter")
      .text("Table with alternating row properties", 230, 30, {
        color: "#000000",
      })
      .table(x, y, contents, {
        columns: columns,
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

    recipe.endPage();
    recipe.endPDF();
  }).timeout(60000);
});

describe("Recipe table layout", () => {
  let directory;
  let output;
  let reader;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "recipe-table-"));
    output = path.join(directory, "table.pdf");
  });

  afterEach(() => {
    if (reader) reader.end();
    reader = undefined;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  function finish(recipe) {
    recipe.endPage().endPDF();
    reader = muhammara.createReader(output);
    return reader;
  }

  function texts(pageIndex = 0) {
    return reader.extractPageText(pageIndex).map((entry) => ({
      content: entry.content,
      x: entry.textMatrix[4],
      y: entry.textMatrix[5],
    }));
  }

  it("includes fields from every record and explicit optional columns", () => {
    const recipe = new Recipe("new", output).createPage(400, 400);
    recipe
      .table(20, 20, [{ a: "A1" }, { a: "A2", b: "B2" }], { header: true })
      .table(20, 120, [{ a: "A3" }], {
        header: true,
        columns: [{ name: "a" }, { name: "note", text: "Note" }],
      })
      .table(20, 220, [{ a: "A4", b: "B4" }], { header: true, order: "b, a" });
    finish(recipe);
    const entries = texts();
    const content = entries.map((entry) => entry.content);
    assert.ok(content.includes("B2"), "a field missing from the first row");
    assert.ok(content.includes("Note"), "an explicit optional column");
    const ordered = entries.filter((entry) => entry.y < 200);
    const b = ordered.find((entry) => entry.content === "b");
    const a = ordered.find((entry) => entry.content === "a");
    assert.ok(b.x < a.x, "order places b before a");
  });

  it("renders nullish values as empty cells and keeps other values", () => {
    const recipe = new Recipe("new", output).createPage(400, 400);
    recipe.table(20, 20, [{ a: null, b: undefined, c: 0, d: false }]);
    finish(recipe);
    const content = texts().map((entry) => entry.content);
    assert.deepEqual(content, ["0", "false"]);
  });

  it("runs each renderer once per cell and sizes rows with its options", () => {
    const calls = [];
    const recipe = new Recipe("new", output).createPage(400, 400);
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
    const entries = texts();
    const control = entries.find((entry) => entry.content === "y");
    const rendered = entries.find((entry) => entry.content === "z");
    assert.ok(
      control.y - rendered.y > 10,
      "the renderer's larger size grows its row",
    );
  });

  it("continues with each position's own bounds and a repeated header", () => {
    let overflows = 0;
    const rows = Array.from({ length: 30 }, (_, index) => ({
      name: `row ${index + 1}`,
    }));
    const recipe = new Recipe("new", output).createPage(300, 300);
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
    const first = texts(0).map((entry) => entry.content);
    const second = texts(1).map((entry) => entry.content);
    assert.equal(first.filter((content) => content === "name").length, 1);
    assert.equal(second.filter((content) => content === "name").length, 1);
    assert.deepEqual(
      [...first, ...second].filter((content) => /^row /.test(content)),
      rows.map((row) => row.name),
    );
    assert.ok(second.includes("later table"));
  });

  it("draws each border line once, keeps its options, and skips empty segments", () => {
    const data = [
      { a: "A1", b: "B1" },
      { a: "A2", b: "B2" },
    ];
    const border = { dash: [3, 2] };
    const recipe = new Recipe("new", output).createPage(300, 300);
    recipe.table(20, 20, data, { header: true, border });
    recipe.endPage().createPage(300, 300);
    recipe.table(20, 290, data, {
      header: true,
      border,
      overflow: () => ({ position: [20, 20] }),
    });
    finish(recipe);
    [0, 1].forEach((pageIndex) => {
      const content = pageContent(reader, pageIndex);
      // One column divider plus the header and first-row separators.
      assert.equal(lineCount(content), 3);
      assert.match(content, /\[\s*3\s+2\s*\]\s*0\s+d/);
    });
    assert.deepEqual(
      border,
      { dash: [3, 2] },
      "border options are not mutated",
    );
  });

  it("returns for empty contents and leaves the cursor below the table", () => {
    const recipe = new Recipe("new", output).createPage(400, 400);
    assert.equal(recipe.table(20, 20, []), recipe);
    recipe.table(40, 20, [{ a: "A" }, { a: "B" }]);
    const [x, y] = recipe.movedown(0, true);
    finish(recipe);
    const last = texts().find((entry) => entry.content === "B");
    assert.equal(x, 40);
    assert.ok(y > 400 - last.y, "the cursor is below the last row");
  });
});
