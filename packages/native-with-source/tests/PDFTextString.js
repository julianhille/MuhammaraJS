var muhammara = require("@muhammara/native-with-source");
var PDFTextString = muhammara.PDFTextString;
var assert = require("chai").assert;

describe("PDFTextString", function () {
  it("requires new when invoking native constructors", function () {
    assert.throws(function () {
      PDFTextString("text");
    }, /called with new/);

    assert.equal(new muhammara.PDFDate().toString(), "");
  });

  it("preserves native property descriptors", function () {
    var page = new muhammara.PDFPage();

    assert.deepEqual(Object.keys(page), [
      "rotate",
      "artBox",
      "trimBox",
      "bleedBox",
      "cropBox",
      "mediaBox",
    ]);
    assert.equal(Object.hasOwn(page, "mediaBox"), true);
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(
        muhammara.PDFPage.prototype,
        "getResourcesDictionary",
      ),
      {
        value: muhammara.PDFPage.prototype.getResourcesDictionary,
        writable: true,
        enumerable: true,
        configurable: true,
      },
    );
  });

  it("create PDFTextString correctly", function () {
    assert.equal(new PDFTextString().toString(), "", "empty starter");
    assert.equal(
      new PDFTextString("Hello World").toString(),
      "Hello World",
      "string starter",
    );
    assert.equal(
      new PDFTextString([
        72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100,
      ]).toString(),
      "Hello World",
      "bytes array starter",
    );
    assert.equal(
      new PDFTextString(
        new PDFTextString("Hello World").toBytesArray(),
      ).toString(),
      "Hello World",
      "bytes array starter, again",
    );
    assert.equal(
      new PDFTextString(["72", "105"]).toString(),
      "Hi",
      "byte values use JavaScript number coercion",
    );
  });

  it("preserves array conversion exceptions", function () {
    assert.throws(function () {
      new PDFTextString([72, Symbol("invalid byte")]);
    }, TypeError);
  });

  it("does not write partial byte or object arrays", function () {
    var writer = muhammara.createWriter(
      __dirname + "/output/CompositeArrayWrites.pdf",
    );
    var output = writer.getOutputFile().getOutputStream();
    var objects = writer.getObjectsContext();

    try {
      var position = output.getCurrentPosition();
      assert.throws(function () {
        output.write([65, Symbol("invalid byte")]);
      }, TypeError);
      assert.equal(output.getCurrentPosition(), position);

      position = output.getCurrentPosition();
      assert.throws(function () {
        objects.writeLiteralString([65, Symbol("invalid byte")]);
      }, TypeError);
      assert.equal(output.getCurrentPosition(), position);

      var dictionary = objects.startDictionary();
      position = output.getCurrentPosition();
      assert.throws(function () {
        dictionary.writeRectangleValue([0, 0, Symbol("invalid box"), 10]);
      }, TypeError);
      assert.equal(output.getCurrentPosition(), position);

      assert.throws(function () {
        dictionary.writeLiteralStringValue([65, Symbol("invalid byte")]);
      }, TypeError);
      assert.equal(output.getCurrentPosition(), position);
      objects.endDictionary(dictionary);
    } finally {
      writer._abort();
    }
  });

  it("preserves legacy embedded-NUL truncation", function () {
    assert.equal(new PDFTextString("A\0B").toString(), "A");

    var text = new PDFTextString("initial");
    text.fromString("C\0D");
    assert.equal(text.toString(), "C");
  });

  it("rejects an invalid native method receiver", function () {
    assert.throws(function () {
      PDFTextString.prototype.toString.call(
        Object.create(PDFTextString.prototype),
      );
    }, TypeError);
  });
});
