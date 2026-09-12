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
        "page-boxes",
        "form-gray",
        "rotated-page",
        "delete-pages",
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
      assert.equal(result.summary.pages, example.expectedPages || 1);
      if (example.id === "delete-pages") {
        assert.deepEqual(result.summary.pageWidths, [300, 340]);
      }
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
});
