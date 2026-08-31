// Byte-first ports of InputFileTest.js and the raw object-writing portions of
// ModifyingExistingFileContent.js and ImagesAndFormsForwardReferenceTest.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("InputFileTest", function () {
  it("reads and writes byte-backed raw objects", async function () {
    var muhammara = await createMuhammaraWasm();
    var bytes = new Uint8Array([10, 20, 30, 40]);
    var reader = new muhammara.ByteReader(bytes);
    assert.deepEqual(reader.read(2), [10, 20]);
    assert.equal(reader.notEnded(), true);
    assert.deepEqual(reader.read(10), [30, 40]);
    assert.equal(reader.notEnded(), false);
    var positionedReader = new muhammara.ByteReaderWithPosition(bytes);
    positionedReader.setPosition(1);
    assert.equal(positionedReader.getCurrentPosition(), 1);
    assert.deepEqual(positionedReader.read(2), [20, 30]);
    positionedReader.setPositionFromEnd(1);
    assert.deepEqual(positionedReader.read(1), [40]);

    var byteWriter = new muhammara.ByteWriter();
    assert.equal(byteWriter.write(new Uint8Array([1, 2])), 2);
    assert.deepEqual(Array.from(byteWriter.toUint8Array()), [1, 2]);
    var positionedWriter = new muhammara.ByteWriterWithPosition();
    positionedWriter.write(new Uint8Array([3, 4]));
    assert.equal(positionedWriter.getCurrentPosition(), 2);

    var writer = muhammara.createWriter();
    var objects = writer.getObjectsContext();
    var annotationId = objects.startNewIndirectObject();
    var annotation = objects.startDictionary();
    annotation
      .writeKey("Type")
      .writeNameValue("Annot")
      .writeKey("Subtype")
      .writeNameValue("Text")
      .writeKey("Rect")
      .writeRectangleValue([10, 10, 50, 50])
      .writeKey("Contents")
      .writeLiteralStringValue(new Uint8Array([114, 97, 119]));
    objects.endDictionary(annotation).endIndirectObject();

    var xObjectId = objects.allocateNewObjectID();
    objects.startNewIndirectObject(xObjectId);
    var streamDictionary = objects.startDictionary();
    streamDictionary
      .writeKey("Type")
      .writeNameValue("XObject")
      .writeKey("Subtype")
      .writeNameValue("Form")
      .writeKey("BBox")
      .writeRectangleValue(0, 0, 10, 10);
    var stream = objects.startUnfilteredPDFStream(streamDictionary);
    assert.equal(
      stream.getWriteStream().write(new TextEncoder().encode("q Q\n")),
      4,
    );
    objects.endPDFStream(stream);

    var free = objects.startFreeContext();
    assert.equal(
      free.write(new TextEncoder().encode("% raw object batch\n")),
      19,
    );
    assert.ok(free.getCurrentPosition() > 0);
    objects.endFreeContext();

    var page = new muhammara.PDFPage(0, 0, 100, 100);
    writer.startPageContentContext(page).q().Q();
    writer.writePage(page);
    var pdf = writer.end();
    assert.match(
      new TextDecoder().decode(pdf),
      new RegExp(`${annotationId} 0 obj`),
    );
    assert.match(
      new TextDecoder().decode(pdf),
      new RegExp(`${xObjectId} 0 obj`),
    );
    var outputReader = muhammara.createReader(pdf);
    assert.equal(outputReader.getPagesCount(), 1);
    assert.equal(
      outputReader
        .parseNewObject(annotationId)
        .toPDFDictionary()
        .queryObject("Contents")
        .toText(),
      "raw",
    );
    outputReader.end();

    var modifier = muhammara.createWriterToModify(pdf);
    var modifiedObjects = modifier.getObjectsContext();
    var modificationId = modifiedObjects.startNewIndirectObject();
    var modification = modifiedObjects.startDictionary();
    modification.writeKey("Type").writeNameValue("Annot");
    modifiedObjects.endDictionary(modification).endIndirectObject();
    var modifiedPdf = modifier.end();
    var modifiedReader = muhammara.createReader(modifiedPdf);
    assert.equal(
      modifiedReader
        .parseNewObject(modificationId)
        .toPDFDictionary()
        .queryObject("Type").value,
      "Annot",
    );
    modifiedReader.end();
  });
});
