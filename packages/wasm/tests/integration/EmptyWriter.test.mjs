// Port of tests/EmptyWriter.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("EmptyWriter", function () {
  it("completes with a versioned byte writer", async function () {
    var muhammara = await createMuhammaraWasm();
    var pdf = muhammara
      .createWriter({ version: muhammara.ePDFVersion14 })
      .end();

    assert.ok(pdf instanceof Uint8Array);
    assert.equal(new TextDecoder().decode(pdf.slice(0, 8)), "%PDF-1.4");
    assert.match(new TextDecoder().decode(pdf), /%%EOF/);
  });
});
