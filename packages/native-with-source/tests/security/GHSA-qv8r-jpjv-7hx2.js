var assert = require("assert");
var muhammara = require("@muhammara/native-with-source");

// Parsing an object of an object stream parses that stream, and its indirect
// /Length, first, and a page tree node parses its kids, each one call deeper.
// About 360 object streams whose /Length is in the next one, or a page tree
// about 850 levels deep, overflowed the Wasm stack; natively, 1000 such
// object streams took 38 seconds.

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
 * Builds a PDF of object streams 3, 5, 7 and so on that each hold the object
 * numbered one higher, 4, 6, 8 and so on, of value 17, and take their /Length
 * from the object of the next one, so parsing object 4 parses them all,
 * `levels` object streams deep.
 *
 * @param {number} levels Number of object streams.
 * @returns {Buffer} The PDF.
 */
function lengthChain(levels) {
  var pdf =
    "%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
    "2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n";
  var xref = xrefEntry(0, 0, 65535) + xrefEntry(1, 9, 0) + xrefEntry(1, 58, 0);
  for (var level = 0; level < levels; ++level) {
    var id = 3 + 2 * level;
    xref += xrefEntry(1, pdf.length, 0) + xrefEntry(2, id, 0);
    pdf +=
      id +
      " 0 obj\n<< /Type /ObjStm /N 1 /First 10 /Length " +
      (level === levels - 1 ? "17" : id + 3 + " 0 R") +
      " >>\nstream\n" +
      String(id + 1).padStart(7, "0") +
      " 0 0000017\nendstream\nendobj\n";
  }
  var size = 3 + 2 * levels + 1;
  var position = pdf.length;
  xref += xrefEntry(1, position, 0);
  pdf +=
    size -
    1 +
    " 0 obj\n<< /Type /XRef /Size " +
    size +
    " /W [1 4 2] /Root 1 0 R /Filter /ASCIIHexDecode /Length " +
    (xref.length + 1) +
    " >>\nstream\n" +
    xref +
    ">\nendstream\nendobj\nstartxref\n" +
    position +
    "\n%%EOF\n";
  return Buffer.from(pdf, "latin1");
}

/**
 * Builds a PDF whose page tree is a chain of /Pages nodes above one page.
 *
 * @param {number} depth Number of nodes from the root to the page.
 * @returns {Buffer} The PDF.
 */
function pageTreeChain(depth) {
  var pdf = "%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  var offsets = [9];
  for (var id = 2; id <= depth + 1; ++id) {
    offsets.push(pdf.length);
    pdf +=
      id +
      " 0 obj\n" +
      (id === depth + 1
        ? "<< /Type /Page /MediaBox [0 0 10 10] >>"
        : "<< /Type /Pages /Kids [" + (id + 1) + " 0 R] /Count 1 >>") +
      "\nendobj\n";
  }
  var position = pdf.length;
  pdf +=
    "xref\n0 " +
    (depth + 2) +
    "\n0000000000 65535 f \n" +
    offsets
      .map((offset) => String(offset).padStart(10, "0") + " 00000 n \n")
      .join("") +
    "trailer\n<< /Size " +
    (depth + 2) +
    " /Root 1 0 R >>\nstartxref\n" +
    position +
    "\n%%EOF\n";
  return Buffer.from(pdf, "latin1");
}

/**
 * Builds a one-page PDF whose page resources start a chain of objects, each
 * a dictionary that references the next one.
 *
 * @param {number} length Number of objects in the chain.
 * @returns {Buffer} The PDF.
 */
function referenceChain(length) {
  var objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] " +
      "/Resources << /Font << /F1 4 0 R >> >> >>",
  ];
  for (var id = 4; id < 3 + length; ++id) {
    objects.push("<< /Next " + (id + 1) + " 0 R >>");
  }
  objects.push("<< >>");
  var pdf = "%PDF-1.7\n";
  var xref = "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  objects.forEach(function (body, index) {
    xref += String(pdf.length).padStart(10, "0") + " 00000 n \n";
    pdf += index + 1 + " 0 obj\n" + body + "\nendobj\n";
  });
  return Buffer.from(
    pdf +
      xref +
      "trailer\n<< /Size " +
      (objects.length + 1) +
      " /Root 1 0 R >>\nstartxref\n" +
      pdf.length +
      "\n%%EOF\n",
    "latin1",
  );
}

describe("GHSA-qv8r-jpjv-7hx2", function () {
  // Objects 4, 6, 8 and so on stay open while the next one is parsed, as
  // does the last object stream, so 31 object streams take the 32 objects
  // the parser may have open at once.
  it("fails to parse an object behind 32 object streams", function () {
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(lengthChain(31)),
    );
    try {
      assert.strictEqual(reader.parseNewObject(4).value, 17);
    } finally {
      reader.end();
    }
    reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(lengthChain(32)),
    );
    try {
      assert.throws(() => reader.parseNewObject(4), /Unable to read object/);
    } finally {
      reader.end();
    }
  });

  it("fails to open a page tree more than 1024 levels deep", function () {
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(pageTreeChain(1024)),
    );
    try {
      assert.strictEqual(reader.getPageObjectID(0), 1025);
    } finally {
      reader.end();
    }
    assert.throws(
      () =>
        muhammara.createReader(
          new muhammara.PDFRStreamForBuffer(pageTreeChain(1025)),
        ),
      /Unable to start parsing PDF file/,
    );
  });

  // Copying an object copied the objects it references one call deeper
  // each, so a chain of about 31000 objects crashed the native process, and
  // one of about 5000 broke Wasm.
  it("copies the pages of a PDF with a reference chain of 100000 objects", function () {
    var output = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(output);
    writer.appendPDFPagesFromPDF(
      new muhammara.PDFRStreamForBuffer(referenceChain(100000)),
    );
    writer.end();
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(output.buffer),
    );
    try {
      assert.ok(reader.getXrefSize() > 100000);
    } finally {
      reader.end();
    }
  });
});
