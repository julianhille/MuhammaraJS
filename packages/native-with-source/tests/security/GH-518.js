var assert = require("assert");
var fs = require("fs");
var muhammara = require("@muhammara/native-with-source");

function OversizedReadStream(buffer) {
  this.buffer = buffer;
  this.position = 0;
}

OversizedReadStream.prototype.read = function (amount) {
  var result = Array.from(
    this.buffer.subarray(this.position, this.position + amount),
  );
  this.position += amount;
  if (result.length === amount) {
    this.returnedOversizedRead = true;
  }
  result.push(0x41);
  return result;
};

OversizedReadStream.prototype.notEnded = function () {
  return this.position < this.buffer.length;
};

OversizedReadStream.prototype.setPosition = function (position) {
  this.position = position;
};

OversizedReadStream.prototype.setPositionFromEnd = function (position) {
  this.position = position;
};

OversizedReadStream.prototype.skip = function (amount) {
  this.position += amount;
};

OversizedReadStream.prototype.getCurrentPosition = function () {
  return this.position;
};

OversizedReadStream.prototype.moveStartPosition = function (position) {
  this.position = position;
};

describe("GH-518", function () {
  it("does not write past the native buffer for oversized stream reads", function () {
    var source = fs.readFileSync(
      __dirname + "/../TestMaterials/XObjectContent.PDF",
    );
    var stream = new OversizedReadStream(source);
    assert.throws(function () {
      muhammara.createReader(stream);
    }, /Unable to start parsing PDF file/);
    assert.strictEqual(stream.returnedOversizedRead, true);
  });
});
