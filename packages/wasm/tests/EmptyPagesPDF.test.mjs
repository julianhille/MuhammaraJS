import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("EmptyPagesPDF", function () {
  it("creates and reads blank pages with a reusable page", async function () {
    var muhammara = await createMuhammaraWasm();
    assert.equal(muhammara.ePDFVersion14, 14);
    assert.equal(muhammara.ePDFVersion20, 20);
    assert.equal(muhammara.KProcsetImageB, "ImageB");
    assert.equal(muhammara.KProcsetImageC, "ImageC");
    assert.equal(muhammara.KProcsetImageI, "ImageI");
    assert.equal(muhammara.kProcsetPDF, "PDF");
    assert.equal(muhammara.kProcsetText, "Text");
    assert.equal(muhammara.ePDFPageBoxCropBox, 1);
    assert.equal(muhammara.ePDFObjectStream, 10);
    assert.equal(muhammara.eXrefEntryUndefined, 3);
    assert.equal(
      muhammara.getTypeLabel(muhammara.ePDFObjectDictionary),
      "Dictionary",
    );
    assert.throws(() => muhammara.getTypeLabel(-1), TypeError);
    var writer = muhammara.createWriter({ version: muhammara.ePDFVersion14 });
    var page = writer.createPage();
    page.mediaBox = [0, 0, 595, 842];
    for (var index = 0; index < 4; ++index) writer.writePage(page);
    var pdf = writer.end();
    var header = new TextDecoder().decode(pdf.slice(0, 8));

    assert.equal(header, "%PDF-1.4");
    assert.match(new TextDecoder().decode(pdf), /%%EOF/);
    var reader = muhammara.createReader(pdf);
    assert.equal(reader.getPDFLevel(), 1.4);
    assert.equal(reader.getPagesCount(), 4);
    assert.ok(reader.getPageObjectID(0) > 0);
    assert.ok(reader.getObjectsCount() > 0);
    assert.equal(reader.isEncrypted(), false);
    assert.ok(reader.getXrefSize() > 0);
    assert.ok(reader.getXrefPosition() > 0);
    assert.ok(reader.getXrefEntry(reader.getPageObjectID(0)));
    assert.notEqual(reader.getTrailerEntryType("Root"), null);
    assert.deepEqual(reader.getPageInfo(0), {
      mediaBox: [0, 0, 595, 842],
      rotate: 0,
      width: 595,
      height: 842,
    });
    assert.deepEqual(reader.getPageBox(0, "crop"), [0, 0, 595, 842]);
    reader.end();
    var version20Writer = muhammara.createWriter({
      version: muhammara.ePDFVersion20,
    });
    version20Writer.writePage(version20Writer.createPage(0, 0, 100, 100));
    var version20Pdf = version20Writer.end();
    assert.equal(
      new TextDecoder().decode(version20Pdf.slice(0, 8)),
      "%PDF-2.0",
    );
    var version20Reader = muhammara.createReader(version20Pdf);
    assert.equal(version20Reader.getPDFLevel(), 2);
    version20Reader.end();
    muhammara.registerFont(
      "arial",
      new Uint8Array(
        await (
          await import("node:fs/promises")
        ).readFile("tests/TestMaterials/fonts/arial.ttf"),
      ),
    );
    var blankPdf = muhammara.createBlankPdf(595, 842);
    var modified = muhammara
      .createModifier(blankPdf)
      .startPage(0)
      .rectangle(20, 20, 100, 50, { fill: "#dbeafe" })
      .circle(200, 200, 20, { stroke: "#2563eb" })
      .line(20, 250, 200, 250, { stroke: "#111827" })
      .text("Modified", 50, 300, { font: "arial", fontSize: 24 })
      .endPage()
      .end();
    var modifiedReader = muhammara.createReader(modified);
    assert.equal(modifiedReader.getPagesCount(), 1);
    modifiedReader.end();
  });
});
