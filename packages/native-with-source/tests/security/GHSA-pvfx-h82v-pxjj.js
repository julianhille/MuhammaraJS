var assert = require("assert");
var path = require("path");
var zlib = require("zlib");
var muhammara = require("@muhammara/native-with-source");

// The start of a cross-reference section grew the table to it.
// XrefTableSectionStart.pdf has a classic subsection at object 50000000,
// which took 1.2 GB natively and aborted Wasm; XrefStreamIndexStart.pdf an
// xref stream /Index section at 9999999990, which aborted the native process
// with std::bad_alloc. XrefPrevChain.pdf chains six sections at 8388607,
// the last object number within the limit, whose /Prev tables were all held
// at once: 1 GB natively, and Wasm aborted, as it did modifying the PDF. Each
// /Prev section was also one recursion, so 2000 of them overflowed the 64 KiB
// Wasm stack, about 3400 the 256 KiB one, and 200000 the native one, and each
// took time up to its highest object number, so 1000 sections at 8388600 took
// 30 seconds.
var materials = path.join(__dirname, "../TestMaterials");

/**
 * Builds a PDF whose classic cross-reference sections form a /Prev chain.
 *
 * @param {number} sections Number of sections.
 * @param {number} size The /Size of each section, which also lists its last
 * object when that is past the catalog and page tree, objects 1 and 2.
 * @returns {Buffer} The PDF.
 */
function prevChain(sections, size) {
  var pdf =
    "%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
    "2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n";
  var prev = "";
  for (var i = 0; i < sections; ++i) {
    var position = pdf.length;
    pdf +=
      "xref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n" +
      "0000000058 00000 n \n" +
      (size > 3 ? size - 1 + " 1\n0000000000 00000 f \n" : "") +
      "trailer\n<< /Size " +
      size +
      " /Root 1 0 R" +
      prev +
      " >>\n";
    prev = " /Prev " + position;
  }
  return Buffer.from(pdf + "startxref\n" + position + "\n%%EOF\n", "latin1");
}

/**
 * Formats a cross-reference stream entry of widths [1 4 2] in hexadecimal.
 *
 * @param {number} type The entry type.
 * @param {number} second An offset, or an object stream number.
 * @param {number} third A generation, or an index in the object stream.
 * @returns {string} The entry's 14 hexadecimal digits.
 */
function xrefEntry(type, second, third) {
  return [
    [type, 2],
    [second, 8],
    [third, 4],
  ]
    .map(([value, digits]) => value.toString(16).padStart(digits, "0"))
    .join("");
}

/**
 * Builds a PDF of object streams 3, 4 and so on whose headers each say they
 * list `size` objects, as many as the cross-reference table has entries, of
 * which each object stream holds the first, of value 17: object stream 3
 * holds object 3 + `streams`, and so on.
 *
 * @param {number} streams Number of object streams.
 * @param {number} size The table size, at least 4 + 2 * `streams`.
 * @param {number} pairs Number of objects each header actually lists.
 * @returns {Buffer} The PDF.
 */
function objectStreams(streams, size, pairs) {
  var pdf = Buffer.from(
    "%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
      "2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n",
    "latin1",
  );
  var xref = xrefEntry(0, 0, 65535) + xrefEntry(1, 9, 0) + xrefEntry(1, 58, 0);
  var held = "";
  for (var id = 3; id < 3 + streams; ++id) {
    var header = id + streams + " 0" + " 0 0".repeat(pairs - 1) + "\n";
    var data = zlib.deflateSync(header + "17");
    xref += xrefEntry(1, pdf.length, 0);
    held += xrefEntry(2, id, 0);
    pdf = Buffer.concat([
      pdf,
      Buffer.from(
        id +
          " 0 obj\n<< /Type /ObjStm /N " +
          size +
          " /First " +
          header.length +
          " /Filter /FlateDecode /Length " +
          data.length +
          " >>\nstream\n",
        "latin1",
      ),
      data,
      Buffer.from("\nendstream\nendobj\n", "latin1"),
    ]);
  }
  var position = pdf.length;
  xref += held + xrefEntry(1, position, 0);
  return Buffer.concat([
    pdf,
    Buffer.from(
      size -
        1 +
        " 0 obj\n<< /Type /XRef /Size " +
        size +
        " /Index [0 " +
        (3 + 2 * streams) +
        " " +
        (size - 1) +
        " 1] /W [1 4 2] /Root 1 0 R /Filter /ASCIIHexDecode /Length " +
        (xref.length + 1) +
        " >>\nstream\n" +
        xref +
        ">\nendstream\nendobj\nstartxref\n" +
        position +
        "\n%%EOF\n",
      "latin1",
    ),
  ]);
}

/**
 * Builds a PDF whose cross-reference stream has entries of no bytes, /W
 * [0 0 0], in `sections` /Index sections of objects 3 to 1048578, above a
 * classic section with the catalog and page tree.
 *
 * @param {number} sections Number of /Index sections.
 * @returns {Buffer} The PDF.
 */
function emptyXrefEntries(sections) {
  var pdf =
    "%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
    "2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n";
  var prev = pdf.length;
  pdf +=
    "xref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n" +
    "0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\n";
  var position = pdf.length;
  pdf +=
    "3 0 obj\n<< /Type /XRef /Size 1048579 /W [0 0 0] /Index [" +
    Array(sections).fill("3 1048576").join(" ") +
    "] /Root 1 0 R /Prev " +
    prev +
    " /Length 1 >>\nstream\n\0\nendstream\nendobj\nstartxref\n" +
    position +
    "\n%%EOF\n";
  return Buffer.from(pdf, "latin1");
}

describe("GHSA-pvfx-h82v-pxjj", function () {
  it("fails to open a classic cross-reference section past 8388608 entries", function () {
    assert.throws(
      () =>
        muhammara.createReader(
          path.join(materials, "XrefTableSectionStart.pdf"),
        ),
      /Unable to start parsing PDF file/,
    );
    assert.throws(
      () =>
        muhammara.createReader(
          new muhammara.PDFRStreamForBuffer(prevChain(1, 8388609)),
        ),
      /Unable to start parsing PDF file/,
    );
  });

  it("fails to open a cross-reference stream section past 8388608 entries", function () {
    assert.throws(
      () =>
        muhammara.createReader(
          path.join(materials, "XrefStreamIndexStart.pdf"),
        ),
      /Unable to start parsing PDF file/,
    );
  });

  it("opens a /Prev chain of sections within the limit", function () {
    var reader = muhammara.createReader(
      path.join(materials, "XrefPrevChain.pdf"),
    );
    try {
      assert.strictEqual(reader.getXrefSize(), 8388608);
    } finally {
      reader.end();
    }
  });

  it("modifies a PDF with sections at the last object number", function () {
    var writer = muhammara.createWriterToModify(
      path.join(materials, "XrefPrevChain.pdf"),
      {
        modifiedFilePath: path.join(
          __dirname,
          "../output/GHSA-pvfx-h82v-pxjj.pdf",
        ),
      },
    );
    writer.end();
  });

  it("opens a /Prev chain of 8000 sections", function () {
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(prevChain(8000, 3)),
    );
    try {
      assert.strictEqual(reader.getXrefSize(), 3);
    } finally {
      reader.end();
    }
  });

  it("fails to open a /Prev chain of 100 sections at object 8388600", function () {
    assert.throws(
      () =>
        muhammara.createReader(
          new muhammara.PDFRStreamForBuffer(prevChain(100, 8388601)),
        ),
      /Unable to start parsing PDF file/,
    );
  });

  // A reader keeps the header of every object stream it read, which /N
  // bounded only per object stream, so four object streams of 33 KB, each
  // listing 8388600 objects, aborted Wasm. A file that writes a new object
  // stream on every save lists objects again in each, so 1048576 more are
  // allowed: ten headers of 131072 objects reach that bound, and an
  // eleventh passes it.
  it("fails to read object streams that list over twice the table and 1048576 objects", function () {
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(objectStreams(11, 131072, 131072)),
    );
    try {
      for (var id = 14; id < 24; ++id) {
        assert.strictEqual(reader.parseNewObject(id).value, 17);
      }
      assert.throws(() => reader.parseNewObject(24), /Unable to read object/);
    } finally {
      reader.end();
    }
  });

  // A header that failed to parse was parsed again for every object of its
  // object stream, each time taking time for all the objects /N says it
  // lists, so 8388600 of them, 34 KB of PDF, took about 2 seconds per object.
  it("fails the objects of an object stream whose header does not parse without parsing it again", function () {
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(objectStreams(1, 65536, 65535)),
    );
    try {
      var start = process.hrtime.bigint();
      assert.throws(() => reader.parseNewObject(4), /Unable to read object/);
      var first = process.hrtime.bigint() - start;
      start = process.hrtime.bigint();
      for (var i = 0; i < 10; ++i) {
        assert.throws(() => reader.parseNewObject(4), /Unable to read object/);
      }
      var again = process.hrtime.bigint() - start;
      assert.ok(
        again < first,
        `10 more reads took ${again} ns, the first ${first} ns`,
      );
    } finally {
      reader.end();
    }
  });

  // Each entry of a cross-reference stream takes time, and its /Index may
  // list the same objects again and again: one-byte entries of zeros
  // deflated twice took 82.7 seconds in a 7.3 KB PDF, and entries of no
  // bytes need no data at all. 128 sections of 1048576 entries reach the
  // bound of 16 * 8388608 entries all cross-reference streams of a PDF may
  // list, and a 129th passes it.
  it("fails to open cross-reference streams that list over 16 tables of entries", function () {
    assert.throws(
      () =>
        muhammara.createReader(
          new muhammara.PDFRStreamForBuffer(emptyXrefEntries(129)),
        ),
      /Unable to start parsing PDF file/,
    );
  });
});
