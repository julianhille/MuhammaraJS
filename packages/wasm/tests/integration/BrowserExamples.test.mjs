import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm, createRecipe } from "../../index.js";
import {
  HOW_TO_EXAMPLES,
  runHowToExample,
} from "../../examples/browser/how-tos.mjs";
import { writeOutput } from "../testOutput.mjs";
import { imagePlacements } from "../recipe/image-placement.mjs";

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
        "benchmark",
        "replace-text",
        "rtl-text",
        "watermark",
        "find-text",
        "inspect-pdf",
      ],
    );
  });

  it("draws Hebrew in visual order in the right-to-left example", async function () {
    var result = await runHowToExample("rtl-text", { assets });
    // The first line is drawn as given; the others are reordered.
    assert.deepEqual(result.summary.drawnHebrew.slice(0, 3), [
      "\u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd",
      "\u05dd\u05dc\u05d5\u05e2 \u05dd\u05d5\u05dc\u05e9",
      "(\u05de\u05f4\u05e2\u05de \u05dc\u05dc\u05d5\u05db) \u05d7\u05f4\u05e9 120 \u05e8\u05d9\u05d7\u05de",
    ]);
    await assert.rejects(runHowToExample("rtl-text", { assets: {} }), {
      message: /font with Hebrew glyphs/,
    });
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
      // The benchmark generates a 120-page PDF and recrypts it; one recrypt
      // per mode keeps it short, and the sanitizer build is much slower.
      if (example.id === "benchmark") this.timeout(120000);
      var result = await runHowToExample(example.id, {
        assets: example.id === "benchmark" ? { ...assets, runs: 1 } : assets,
      });
      writeOutput(`BrowserExamples-${example.id}`, result.bytes);
      assert(result.bytes instanceof Uint8Array);
      assert(result.bytes.length > 100);
      assert.equal(result.summary.pages, example.expectedPages || 1);
      if (example.id === "benchmark") {
        assert.deepEqual(
          result.summary.results.map((entry) => entry.mode),
          ["sync recrypt() on the page", "recryptAsync() on the page"],
        );
        for (var entry of result.summary.results) {
          assert.equal(entry.runs, 1);
          assert.ok(entry.recryptMedianMs > 0);
        }
      }
      if (example.id === "delete-pages") {
        assert.deepEqual(result.summary.pageWidths, [300, 340]);
      }
      if (example.id === "replace-text") {
        assert.equal(result.summary.replacement, "Status: geprüft");
        assert.deepEqual(result.summary.textMatrix, [1, 0, 0, 1, 72, 180]);
      }
      assert.match(result.filename, /^muhammara-.+\.pdf$/);
    });
  }

  it("places a framed page of an uploaded PDF in the image example", async function () {
    var Recipe = await createRecipe();
    var pdf = new Recipe().createPage(200, 100).endPage().endPDF();
    var result = await runHowToExample("image-transform", {
      assets: { png: assets.png, pdf },
    });
    writeOutput("BrowserExamples-image-transform-pdf", result.bytes);
    assert.equal(result.summary.pdfPage, "Uploaded PDF");
    var muhammara = await createMuhammaraWasm();
    var placements = imagePlacements(muhammara, result.bytes, {
      pageBoxes: [[0, 0, 200, 100]],
    });
    var box = [
      [207.5, 107],
      [387.5, 107],
      [387.5, 197],
      [207.5, 197],
    ];
    var framed = placements.slice(-3);
    assert.deepEqual(
      framed.map((placement) => placement.kind),
      ["fill", "page", "stroke"],
    );
    assert.deepEqual(framed[0].corners, box);
    assert.deepEqual(framed[1].corners, box);
    assert.deepEqual(framed[2].dash, [4, 2]);
  });

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

  it("finds non-ASCII text that a composite font shows as glyph IDs", async function () {
    var muhammara = await createMuhammaraWasm();
    muhammara.registerFont(
      "find-text-font",
      new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/fonts/arial.ttf",
            import.meta.url,
          ),
        ),
      ),
    );
    var writer = muhammara.createWriter();
    var page = writer.createPage(0, 0, 300, 200);
    writer
      .startPageContentContext(page)
      .BT()
      .Tf(writer.getFontForBytes("find-text-font"), 18)
      .Tm(1, 0, 0, 1, 40, 100)
      .Tj("Größe Ω")
      .ET();
    writer.writePage(page);
    var pdf = writer.end();
    muhammara.unregisterFont("find-text-font");
    muhammara.disposeAssets();

    var result = await runHowToExample("find-text", {
      assets: { pdf, search: "Ω" },
    });
    writeOutput("BrowserExamples-find-text-composite", result.bytes);
    assert.equal(result.summary.matches, 1);
    assert.deepEqual(result.summary.highlightedPages, [1]);
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

  describe("benchmark tab", function () {
    var originalSetTimeout = globalThis.setTimeout;
    var originalClearTimeout = globalThis.clearTimeout;
    var pending;
    var calls;

    beforeEach(function () {
      // Track the timers the example starts, to find leaks and count the
      // macrotasks it yields to between recrypts.
      pending = new Set();
      calls = [];
      /**
       * Records each delay and tracks the timer until it fires or is cleared.
       * @param {Function} callback - Timer callback.
       * @param {number} delay - Delay in milliseconds.
       * @param {...*} rest - Callback arguments.
       * @returns {*} The timer.
       */
      globalThis.setTimeout = function (callback, delay, ...rest) {
        calls.push(delay);
        var timer = originalSetTimeout(function () {
          pending.delete(timer);
          callback(...rest);
        }, delay);
        pending.add(timer);
        return timer;
      };
      /**
       * Clears a timer and stops tracking it.
       * @param {*} timer - The timer.
       * @returns {void}
       */
      globalThis.clearTimeout = function (timer) {
        pending.delete(timer);
        originalClearTimeout(timer);
      };
    });

    afterEach(function () {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
      for (var timer of pending) originalClearTimeout(timer);
    });

    it("does not block the other tabs with its hidden runs field", async function () {
      var page = await readFile(
        new URL("../../examples/browser/index.html", import.meta.url),
        "utf8",
      );
      // The runs field is a constrained number input in the shared form; a
      // hidden invalid value must not stop the form from submitting.
      assert.match(page, /<form id="example-form"[^>]*\snovalidate[\s>]/);
    });

    it("runs a whole number of recrypts from 1 to 50 without form validation", async function () {
      this.timeout(60000);
      var Recipe = await createRecipe();
      var pdf = new Recipe().createPage(100, 100).endPage().endPDF();
      for (var [runs, expected] of [
        ["2.4", 2],
        ["0", 1],
        ["-3", 1],
        ["80", 50],
        ["", 5],
        [" ", 5],
        ["many", 5],
      ]) {
        var yields = calls.filter((delay) => delay === 0).length;
        var result = await runHowToExample("benchmark", {
          assets: { pdf, runs },
        });
        for (var mode of result.summary.results) {
          assert.equal(mode.runs, expected, `runs ${JSON.stringify(runs)}`);
        }
        // Each recrypt on the page yields once; both page modes ran.
        assert.equal(
          calls.filter((delay) => delay === 0).length - yields,
          2 * expected,
        );
      }
    });

    it("stops sampling when a mode fails", async function () {
      await assert.rejects(
        runHowToExample("benchmark", {
          assets: { pdf: new TextEncoder().encode("not a pdf"), runs: 1 },
        }),
        /Unable to recrypt PDF/,
      );
      var before = calls.length;
      await new Promise((resolve) => originalSetTimeout(resolve, 50));
      assert.equal(calls.length, before, "the sampler kept rescheduling");
      assert.equal(pending.size, 0);
    });

    it("stops recrypting when cancelled during a mode", async function () {
      this.timeout(60000);
      var Recipe = await createRecipe();
      var pdf = new Recipe().createPage(100, 100).endPage().endPDF();
      var controller = new AbortController();
      var running = runHowToExample("benchmark", {
        assets: { pdf, runs: 50 },
        signal: controller.signal,
      });
      // Cancel once the first recrypt yielded to the event loop.
      /**
       * Counts the zero-delay timers: one per recrypt on the page.
       * @returns {number} The count so far.
       */
      var yields = () => calls.filter((delay) => delay === 0).length;
      while (yields() === 0) {
        await new Promise((resolve) => originalSetTimeout(resolve, 0));
      }
      controller.abort();
      await assert.rejects(running, { name: "AbortError" });
      assert.ok(yields() <= 2, `ran ${yields()} recrypts after Cancel`);
    });
  });
});
