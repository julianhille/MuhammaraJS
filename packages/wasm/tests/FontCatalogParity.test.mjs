// Byte-first coverage for PDFWriter font collection overloads and catalog updates.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

describe("FontCatalogParity", function () {
  it("selects TTC faces by index and retains font metrics", async function () {
    var muhammara = await createMuhammaraWasm();
    muhammara.registerFont(
      "lucida",
      new Uint8Array(
        await readFile("tests/TestMaterials/fonts/LucidaGrande.ttc"),
      ),
    );

    var writer = muhammara.createWriter();
    var firstFace = writer.getFontForBytes("lucida", 0);
    var secondFace = writer.getFontForBytes("lucida", 1);
    assert.ok(firstFace.calculateTextDimensions("TTC", 12).width > 0);
    assert.ok(secondFace.getFontMetrics(12).height > 0);
    assert.throws(
      () => writer.getFontForBytes("lucida", -1),
      /non-negative 32-bit integer/,
    );
    assert.throws(
      () => writer.getFontForBytes("lucida", 0, 1),
      /metrics name before a font index/,
    );
    muhammara.registerFont(
      "courier",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/Courier.dfont")),
    );
    assert.ok(
      writer.getFontForBytes("courier", 0).getFontMetrics(12).height > 0,
    );
    writer.end();
  });

  it("rewrites the modified catalog when requested", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    sourceWriter.writePage(sourceWriter.createPage(0, 0, 100, 100));
    var source = sourceWriter.end();
    var writer = muhammara.createWriterToModify(source);
    assert.equal(writer.requireCatalogUpdate(), undefined);
    var output = writer.end();
    assert.equal(
      (new TextDecoder().decode(source).match(/\/Type \/Catalog/g) || [])
        .length,
      1,
    );
    assert.ok(
      (new TextDecoder().decode(output).match(/\/Type \/Catalog/g) || [])
        .length,
      2,
    );
  });
});
