import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
        "image-transform",
        "table",
        "passwords",
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
});
