/*
    PDFRStreamForBuffer is an implementation of a read stream using a supplied array

    @author Luciano Júnior
*/

function PDFRStreamForBuffer(buffer) {
  this.buffer = buffer;
  this.rposition = 0;
  this.fileSize = this.buffer.length;
  this.mStartPosition = 0;
}

PDFRStreamForBuffer.prototype.read = function (inAmount) {
  // Copy, so callers cannot change the source through the returned chunk.
  var bytes = Buffer.from(
    this.buffer.subarray(this.rposition, this.rposition + inAmount),
  );
  this.rposition += inAmount;
  return bytes;
};

PDFRStreamForBuffer.prototype.notEnded = function () {
  return this.rposition < this.fileSize;
};

PDFRStreamForBuffer.prototype.setPosition = function (inPosition) {
  this.rposition = Math.min(
    Math.max(this.mStartPosition + inPosition, 0),
    this.fileSize,
  );
};

PDFRStreamForBuffer.prototype.setPositionFromEnd = function (inPosition) {
  this.rposition = Math.min(
    Math.max(this.fileSize - inPosition, 0),
    this.fileSize,
  );
};

PDFRStreamForBuffer.prototype.skip = function (inAmount) {
  this.rposition += inAmount;
};

PDFRStreamForBuffer.prototype.getCurrentPosition = function () {
  return this.rposition - this.mStartPosition;
};

PDFRStreamForBuffer.prototype.moveStartPosition = function (inPosition) {
  this.mStartPosition = inPosition;
};

module.exports = PDFRStreamForBuffer;
