import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../../index.js";
import {
  HOW_TO_EXAMPLES,
  runHowToExample,
} from "../../examples/browser/how-tos.mjs";
import { writeOutput } from "../testOutput.mjs";

describe("Browser how-to examples", function () {
  var assets;

  before(async function () {
    assets = {
      font: new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/fonts/arial.ttf",
            import.meta.url,
          ),
        ),
      ),
      png: new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/images/png/original.png",
            import.meta.url,
          ),
        ),
      ),
    };
  });

  it("defines the focused tab set", function () {
    assert.deepEqual(
      HOW_TO_EXAMPLES.map((example) => example.id),
      [
        "annotations",
        "links",
        "html-lists",
        "page-boxes",
        "form-gray",
        "rotated-page",
        "delete-pages",
        "image-transform",
        "table",
        "passwords",
        "replace-text",
        "watermark",
        "find-text",
        "inspect-pdf",
      ],
    );
  });

  it("renders a tab for every focused example", async function () {
    var page = await readFile(
      new URL("../../examples/browser/index.html", import.meta.url),
      "utf8",
    );
    for (var example of HOW_TO_EXAMPLES) {
      assert.match(page, new RegExp(`data-example="${example.id}"`));
    }
    assert.match(page, /id="version-picker"/);
  });

  for (const example of HOW_TO_EXAMPLES) {
    it(`generates the ${example.label} PDF`, async function () {
      var result = await runHowToExample(example.id, { assets });
      writeOutput(`BrowserExamples-${example.id}`, result.bytes);
      assert(result.bytes instanceof Uint8Array);
      assert(result.bytes.length > 100);
      assert.equal(result.summary.pages, example.expectedPages || 1);
      if (example.id === "delete-pages") {
        assert.deepEqual(result.summary.pageWidths, [300, 340]);
      }
      assert.match(result.filename, /^muhammara-.+\.pdf$/);
    });
  }

  it("renders table text without any uploaded assets", async function () {
    var result = await runHowToExample("table");
    writeOutput("BrowserExamples-table-no-assets", result.bytes);
    assert.equal(result.summary.font, "Roboto (bundled)");
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(result.bytes);
    try {
      assert.ok(
        reader
          .extractPageText(0)
          .some((item) => item.content === "Browser-generated project table"),
      );
      assert.match(new TextDecoder().decode(result.bytes), /Roboto-Regular/);
    } finally {
      reader.end();
      muhammara.disposeAssets();
    }
  });

  it("renders list markers, nesting, and links in the HTML list example", async function () {
    var result = await runHowToExample("html-lists");
    writeOutput("BrowserExamples-html-lists-links", result.bytes);
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(result.bytes);
    try {
      var text = reader
        .extractPageText(0)
        .map((item) => item.content)
        .join("");
      assert.ok(text.includes("* DOM-free parsing"));
      assert.ok(text.includes("1. Scoped numbering"));
      assert.ok(text.includes("2. Nested indentation"));
      assert.match(
        new TextDecoder().decode(result.bytes),
        /\/URI \(https:\/\/github\.com\/julianhille\/MuhammaraJS\)/,
      );
    } finally {
      reader.end();
      muhammara.disposeAssets();
    }
  });

  it("watermarks every page of the built-in sample with custom text", async function () {
    var result = await runHowToExample("watermark", {
      assets: { watermark: "  PRIVATE  " },
    });
    writeOutput("BrowserExamples-watermark-sample", result.bytes);
    assert.equal(result.summary.source, "Built-in sample");
    assert.equal(result.summary.watermark, "PRIVATE");
    assert.equal(result.summary.watermarkedPages, 2);
    var content = new TextDecoder("latin1").decode(result.bytes);
    assert.equal(content.match(/\(PRIVATE\) Tj/g)?.length, 2);
    assert.match(content, /\/ca 0\.25/);
  });

  it("watermarks an uploaded PDF, including rotated pages", async function () {
    var pdf = new Uint8Array(
      await readFile(
        new URL(
          "../../../native-with-source/tests/TestMaterials/recipe/test-P-90.pdf",
          import.meta.url,
        ),
      ),
    );
    var result = await runHowToExample("watermark", { assets: { pdf } });
    writeOutput("BrowserExamples-watermark-upload", result.bytes);
    assert.equal(result.summary.source, "Uploaded PDF");
    assert.equal(result.summary.watermark, "CONFIDENTIAL");
    assert.equal(result.summary.watermarkedPages, result.summary.pages);
    assert.match(
      new TextDecoder("latin1").decode(result.bytes),
      /\(CONFIDENTIAL\) Tj/,
    );
  });

  it("highlights every match of the default query in the built-in sample", async function () {
    var result = await runHowToExample("find-text");
    writeOutput("BrowserExamples-find-text-sample", result.bytes);
    assert.equal(result.summary.source, "Built-in sample");
    assert.equal(result.summary.query, "Draft");
    assert.equal(result.summary.matches, 4);
    assert.deepEqual(result.summary.highlightedPages, [1, 2]);
    var content = new TextDecoder("latin1").decode(result.bytes);
    var rectangles = Array.from(
      content.matchAll(/\/Subtype \/Highlight[^]*?\/Rect \[([^\]]+)\]/g),
      (match) => match[1].trim().split(/\s+/).map(Number),
    );
    assert.equal(rectangles.length, 4);
    // "Draft for review" starts the line: the first highlight starts at the
    // text origin and spans the text's baseline.
    var first = result.summary.firstMatches[0];
    assert.equal(rectangles[0][0], first.x);
    assert.ok(rectangles[0][1] < first.baseline);
    assert.ok(rectangles[0][3] > first.baseline);
    // "This Draft ..." offsets the second highlight by the advance of "This ".
    assert.ok(rectangles[1][0] > result.summary.firstMatches[1].x + 20);
  });

  it("reports skipped rotated pages and no matches without failing", async function () {
    var pdf = new Uint8Array(
      await readFile(
        new URL(
          "../../../native-with-source/tests/TestMaterials/recipe/test-P-90.pdf",
          import.meta.url,
        ),
      ),
    );
    var rotated = await runHowToExample("find-text", {
      assets: { pdf, search: "Rotate" },
    });
    assert.equal(rotated.summary.matches, 0);
    assert.deepEqual(rotated.summary.skippedRotatedPages, [1]);
    var missing = await runHowToExample("find-text", {
      assets: { search: "  not in the sample  " },
    });
    assert.equal(missing.summary.query, "not in the sample");
    assert.equal(missing.summary.matches, 0);
    assert.equal(missing.summary.pages, 2);
  });

  it("inspects the built-in sample into a one-page report", async function () {
    var result = await runHowToExample("inspect-pdf");
    writeOutput("BrowserExamples-inspect-pdf-sample", result.bytes);
    var inspected = result.summary.inspected;
    assert.equal(result.summary.source, "Built-in sample");
    assert.equal(inspected.pages, 2);
    assert.equal(inspected.encrypted, false);
    assert.equal(inspected.info.Title, "Service agreement");
    assert.equal(inspected.info.Status, "Draft");
    assert.equal(Object.keys(inspected.info)[0], "Title");
    assert.deepEqual(
      inspected.pageDetails.map((page) => [
        page.page,
        page.width,
        page.height,
        page.textOperations,
      ]),
      [
        [1, 595, 842, 4],
        [2, 595, 842, 2],
      ],
    );
    assert.deepEqual(inspected.bookmarks, [
      { title: "Service agreement", page: 1, children: [] },
      { title: "Pricing appendix", page: 2, children: [] },
    ]);
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(result.bytes);
    try {
      var text = reader.extractPageText(0).map((item) => item.content);
      assert.ok(text.includes("PDF inspection report"));
      assert.ok(text.includes("Pricing appendix"));
    } finally {
      reader.end();
      muhammara.disposeAssets();
    }
  });

  it("counts XObjects in an uploaded PDF", async function () {
    var pdf = new Uint8Array(
      await readFile(
        new URL(
          "../../../native-with-source/tests/TestMaterials/BasicJPGImagesTest.PDF",
          import.meta.url,
        ),
      ),
    );
    var result = await runHowToExample("inspect-pdf", { assets: { pdf } });
    assert.equal(result.summary.source, "Uploaded PDF");
    assert.equal(result.summary.pages, 1);
    assert.deepEqual(
      result.summary.inspected.pageDetails.map((page) => [
        page.images,
        page.forms,
      ]),
      [[1, 1]],
    );
  });

  it("keeps the report of a long uploaded PDF on one page", async function () {
    var pdf = new Uint8Array(
      await readFile(
        new URL(
          "../../../native-with-source/tests/TestMaterials/recipe/compressed.tracemonkey-pldi-09.pdf",
          import.meta.url,
        ),
      ),
    );
    var result = await runHowToExample("inspect-pdf", { assets: { pdf } });
    writeOutput("BrowserExamples-inspect-pdf-long", result.bytes);
    assert.equal(result.summary.inspected.pages, 14);
    assert.equal(result.summary.inspected.pageDetails.length, 14);
    assert.equal(result.summary.pages, 1);
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(result.bytes);
    try {
      assert.ok(
        reader.extractPageText(0).some((item) => item.content === "+ 9 more"),
      );
    } finally {
      reader.end();
      muhammara.disposeAssets();
    }
  });

  it("reports an encrypted PDF without reading its contents", async function () {
    var pdf = new Uint8Array(
      await readFile(
        new URL(
          "../../../native-with-source/tests/TestMaterials/Protected.pdf",
          import.meta.url,
        ),
      ),
    );
    var result = await runHowToExample("inspect-pdf", { assets: { pdf } });
    var inspected = result.summary.inspected;
    assert.equal(inspected.encrypted, true);
    assert.deepEqual(inspected.info, {});
    assert.deepEqual(inspected.pageDetails, []);
    assert.deepEqual(inspected.bookmarks, []);
    assert.equal(result.summary.pages, 1);
  });
});
