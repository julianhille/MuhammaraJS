import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../../index.js";
import {
  HOW_TO_EXAMPLES,
  runHowToExample,
} from "../../examples/browser/how-tos.mjs";

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
        "image-transform",
        "table",
        "passwords",
        "replace-text",
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
  });

  for (const example of HOW_TO_EXAMPLES) {
    it(`generates the ${example.label} PDF`, async function () {
      var result = await runHowToExample(example.id, { assets });
      assert(result.bytes instanceof Uint8Array);
      assert(result.bytes.length > 100);
      assert.equal(result.summary.pages, 1);
      assert.match(result.filename, /^muhammara-.+\.pdf$/);
    });
  }

  it("renders table text without any uploaded assets", async function () {
    var result = await runHowToExample("table");
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
});
