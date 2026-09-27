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
});
