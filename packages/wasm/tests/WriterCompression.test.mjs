// Verifies createWriter({ compress }) configures native PDFCreationSettings.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("WriterCompression", function () {
  it("uses the requested stream filter mode", async function () {
    var muhammara = await createMuhammaraWasm();

    function create(compress) {
      var writer = muhammara.createWriter({ compress });
      var page = writer.createPage();
      writer.startPageContentContext(page).q().re(1, 1, 10, 10).f().Q();
      writer.writePage(page);
      return new TextDecoder().decode(writer.end());
    }

    assert.match(create(true), /\/Filter \/FlateDecode/);
    assert.doesNotMatch(create(false), /\/Filter \/FlateDecode/);
    assert.throws(
      () => muhammara.createWriter({ compress: "false" }),
      /compress must be a boolean/,
    );
  });
});
