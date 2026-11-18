var assert = require("assert");
var fs = require("fs");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

// Objects 4 to 9, the content streams of page 0, are Flate streams whose
// predictors ask for too much memory: PNG (4, 5) and TIFF (6, 7) rows of 2^53
// one-byte columns, which aborted the native process with bad_alloc, and of
// 67108867 three-color 16-bit columns (402 MB); two TIFF stages with 16 MiB
// rows of 1-bit colors (8; 272 MiB each); and eight stages, seven of them TIFF
// with 1 MiB rows of 1-bit colors (17 MiB each), whose last /DecodeParms entry
// is in an object stream with such a chain, four levels deep (9; 612 MiB held
// while the chains were set up). Object 10 has nine Flate filters.
var source = path.join(__dirname, "../TestMaterials/PredictorAllocation.pdf");

describe("GHSA-rw3m-455p-xvhr", function () {
  it("reads nothing from predictor streams that ask for too much memory", function () {
    var reader = muhammara.createReader(source);
    try {
      for (var id = 4; id <= 9; ++id) {
        var stream = reader.startReadingFromStream(reader.parseNewObject(id));
        assert.deepStrictEqual(stream.read(4096), Buffer.alloc(0));
        assert.strictEqual(stream.notEnded(), false);
      }
      assert.deepStrictEqual(reader.extractPageText(0), []);
    } finally {
      reader.end();
    }
  });

  // A byte reader holds its whole decoder chain, here eight predictor stages
  // of 17 MiB each, until it is disposed or garbage-collected.
  it("disposes stream readers, also the ones extractPageText() opens", function () {
    var reader = muhammara.createReader(source);
    try {
      var stream = reader.startReadingFromStream(reader.parseNewObject(9));
      assert.strictEqual(stream.dispose(), stream);
      assert.strictEqual(stream.dispose(), stream);
      assert.throws(() => stream.read(1), /PDF byte reader has ended/);
      assert.throws(() => stream.notEnded(), /PDF byte reader has ended/);
    } finally {
      reader.end();
    }
    reader = muhammara.createReader(
      path.join(__dirname, "../TestMaterials/Original.pdf"),
    );
    var opened = [];
    var startReadingFromStream = reader.startReadingFromStream;
    reader.startReadingFromStream = function (stream) {
      var streamReader = startReadingFromStream.call(this, stream);
      opened.push(streamReader);
      return streamReader;
    };
    try {
      // Decoding the text reads the font's ToUnicode stream.
      assert.strictEqual(reader.extractPageText(0)[0].text, "1");
      assert.strictEqual(opened.length, 1);
      assert.throws(() => opened[0].notEnded(), /PDF byte reader has ended/);
    } finally {
      reader.end();
    }
  });

  it("rejects a read amount that is not an integer from 0 to 2^31 - 1", function () {
    var reader = muhammara.createReader(source);
    try {
      var stream = reader.startReadingFromStream(reader.parseNewObject(9));
      [1.5, -1, 2 ** 31, NaN].forEach(function (amount) {
        assert.throws(() => stream.read(amount), {
          name: "RangeError",
          message: "read requires a non-negative integer",
        });
      });
    } finally {
      reader.end();
    }
  });

  // Object 3 is LZW data, whose decoder writes a byte whatever size it is
  // asked for: read(0) wrote it through the null data of an empty buffer and
  // crashed the process.
  it("reads nothing for a read amount of 0", function () {
    var reader = muhammara.createReader(
      path.join(__dirname, "../TestMaterials/LZWStream.pdf"),
    );
    try {
      var stream = reader.startReadingFromStream(reader.parseNewObject(3));
      assert.deepStrictEqual(stream.read(0), Buffer.alloc(0));
      assert.strictEqual(stream.read(1).toString("latin1"), "h");
    } finally {
      reader.end();
    }
  });

  // Like ending the reader (BufferReadTest.js), disposing of a byte reader
  // from a stream callback of its read() or notEnded() freed the decoders
  // that call was running, and reading from it there re-entered them.
  it("rejects using a byte reader from a stream callback while it reads", function () {
    var source = new muhammara.PDFRStreamForBuffer(
      fs.readFileSync(path.join(__dirname, "../TestMaterials/Original.pdf")),
    );
    var errors = [];
    var stream;
    var reading = false;
    ["read", "notEnded"].forEach(function (method) {
      var call = source[method].bind(source);
      source[method] = function (...args) {
        if (reading) {
          [
            () => stream.dispose(),
            () => stream.read(1),
            () => stream.notEnded(),
          ].forEach(function (use) {
            try {
              use();
            } catch (error) {
              errors.push(error.message);
            }
          });
        }
        return call(...args);
      };
    });
    var reader = muhammara.createReader(source);
    try {
      stream = reader.startReadingFromStream(
        reader.queryDictionaryObject(reader.parsePageDictionary(0), "Contents"),
      );
      reading = true;
      assert.strictEqual(stream.notEnded(), true);
      var notEndedErrors = errors.length;
      assert.strictEqual(stream.read(4096).length, 130);
      reading = false;
      assert.ok(notEndedErrors >= 3 && errors.length > notEndedErrors);
      assert.deepStrictEqual(
        errors,
        Array(errors.length).fill(
          "A PDF byte reader cannot be used from a stream callback while it is reading",
        ),
      );
      assert.strictEqual(stream.dispose(), stream);
    } finally {
      reader.end();
    }
  });

  it("fails to read a stream with more than eight filters", function () {
    var reader = muhammara.createReader(source);
    try {
      assert.throws(
        () => reader.startReadingFromStream(reader.parseNewObject(10)),
        /Unable to read PDF stream/,
      );
    } finally {
      reader.end();
    }
  });
});
