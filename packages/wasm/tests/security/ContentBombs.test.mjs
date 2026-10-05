// Compressed page content that expands far beyond its file size, found by
// fuzzing (tests/fuzz). Extraction is bounded by decoded bytes, not only by
// parsed objects, and one token cannot grow until allocation fails.
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { createMuhammaraWasm } from "../../index.js";

/**
 * Builds a one-page PDF whose content stream is `content`, Flate-compressed.
 * @param {Uint8Array} content - Decoded page content.
 * @returns {Uint8Array} The PDF.
 */
function pdfWithContent(content) {
  var stream = deflateSync(content, { level: 9 });
  var objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>",
  ];
  var parts = [Buffer.from("%PDF-1.7\n")];
  var length = parts[0].length;
  var offsets = [];
  /**
   * Appends bytes to the PDF and advances the running offset.
   * @param {Uint8Array} bytes - Bytes to append.
   */
  var push = (bytes) => {
    parts.push(bytes);
    length += bytes.length;
  };
  objects.forEach((body, index) => {
    offsets.push(length);
    push(Buffer.from(`${index + 1} 0 obj\n${body}\nendobj\n`));
  });
  offsets.push(length);
  push(
    Buffer.from(
      `4 0 obj\n<< /Filter /FlateDecode /Length ${stream.length} >>\nstream\n`,
    ),
  );
  push(stream);
  push(Buffer.from("\nendstream\nendobj\n"));
  var xref = length;
  push(
    Buffer.from(
      `xref\n0 5\n0000000000 65535 f \n${offsets
        .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
        .join(
          "",
        )}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
    ),
  );
  return new Uint8Array(Buffer.concat(parts));
}

/**
 * Builds a one-page PDF whose catalog refers to object 4, `body`, which the
 * file parser reads as it is, without decoding.
 * @param {Buffer} body - Object 4's content.
 * @returns {Buffer} The PDF.
 */
function pdfWithObject(body) {
  var objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R /Big 4 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>"),
    body,
  ];
  var parts = [Buffer.from("%PDF-1.7\n")];
  var length = parts[0].length;
  var offsets = [];
  objects.forEach((object, index) => {
    offsets.push(length);
    var bytes = Buffer.concat([
      Buffer.from(index + 1 + " 0 obj\n"),
      object,
      Buffer.from("\nendobj\n"),
    ]);
    parts.push(bytes);
    length += bytes.length;
  });
  parts.push(
    Buffer.from(
      "xref\n0 5\n0000000000 65535 f \n" +
        offsets
          .map((offset) => String(offset).padStart(10, "0") + " 00000 n \n")
          .join("") +
        "trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n" +
        length +
        "\n%%EOF\n",
    ),
  );
  return Buffer.concat(parts);
}

describe("content bombs", function () {
  this.timeout(60000);
  var muhammara;
  // 96 MiB of whitespace and a 40 MiB unterminated string: past the 64 MiB
  // content ceiling and the 32 MiB token ceiling, from about 100 KB of PDF.
  var whitespace = pdfWithContent(Buffer.alloc(96 << 20, 0x20));
  var string = pdfWithContent(
    Buffer.concat([Buffer.from("BT ("), Buffer.alloc(40 << 20, 0x61)]),
  );

  before(async function () {
    muhammara = await createMuhammaraWasm();
  });

  for (var [name, bytes] of [
    ["whitespace", whitespace],
    ["an unterminated string", string],
  ]) {
    it(`stops extracting text from ${name} at the content ceiling`, function () {
      var reader = muhammara.createReader(bytes);
      try {
        assert.throws(
          () => reader.extractPageText(0),
          /exceeds text extraction limits/,
        );
        assert.throws(
          () => reader.extractPageContentItems(0),
          /exceeds item extraction limits/,
        );
      } finally {
        reader.end();
      }
    });
  }

  it("ends an object parser at a token longer than 32 MiB", function () {
    var reader = muhammara.createReader(string);
    try {
      var stream = reader
        .queryDictionaryObject(reader.parsePageDictionary(0), "Contents")
        .toPDFStream();
      var parser = reader.startReadingObjectsFromStream(stream);
      assert.equal(parser.parseNewObject().toString(), "BT");
      // The string token fails instead of growing until allocation fails,
      // which escaped the module as a bare number.
      assert.equal(parser.parseNewObject(), undefined);
      // The parser stays stopped instead of resuming inside the string.
      assert.equal(parser.parseNewObject(), undefined);
      parser.end();
    } finally {
      reader.end();
    }
  });

  it("fails a name longer than 32 MiB instead of cutting it off", function () {
    // A closed token, unlike the unterminated string above: it used to come
    // back as a valid 32 MiB name.
    var reader = muhammara.createReader(
      pdfWithContent(
        Buffer.concat([
          Buffer.from("BT /"),
          Buffer.alloc(40 << 20, 0x61),
          Buffer.from(" 12 Tf ET"),
        ]),
      ),
    );
    try {
      var stream = reader
        .queryDictionaryObject(reader.parsePageDictionary(0), "Contents")
        .toPDFStream();
      var parser = reader.startReadingObjectsFromStream(stream);
      assert.equal(parser.parseNewObject().toString(), "BT");
      assert.equal(parser.parseNewObject(), undefined);
      assert.equal(parser.parseNewObject(), undefined);
      parser.end();
    } finally {
      reader.end();
    }
  });

  it("charges skipped inline images to the content ceiling", function () {
    // Three 24 MiB inline images: each fits the ceiling, together they don't.
    var image = Buffer.concat([
      Buffer.from("BI /W 1 /H 1 /BPC 8 /CS /G ID "),
      Buffer.alloc(24 << 20, 0x78),
      Buffer.from(" EI\n"),
    ]);
    var reader = muhammara.createReader(
      pdfWithContent(Buffer.concat([image, image, image])),
    );
    try {
      assert.throws(
        () => reader.extractPageText(0),
        /exceeds text extraction limits/,
      );
      assert.throws(
        () => reader.extractPageContentItems(0),
        /exceeds item extraction limits/,
      );
    } finally {
      reader.end();
    }
  });

  it("reads a string longer than 32 MiB from the file itself", function () {
    // The token ceiling bounds decoded streams only; a file's own tokens are
    // bounded by its size.
    var reader = muhammara.createReader(
      pdfWithObject(
        Buffer.concat([
          Buffer.from("("),
          Buffer.alloc(33 << 20, 0x61),
          Buffer.from(")"),
        ]),
      ),
    );
    try {
      assert.equal(reader.parseNewObject(4).value.length, 33 << 20);
    } finally {
      reader.end();
    }
  });
});
