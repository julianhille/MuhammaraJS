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
  var amountToRead = inAmount;
  var arr = Array.from(
    this.buffer.subarray(this.rposition, this.rposition + amountToRead),
  );
  this.rposition += amountToRead;
  return arr;
};

PDFRStreamForBuffer.prototype.notEnded = function () {
  return this.rposition < this.fileSize;
};

PDFRStreamForBuffer.prototype.setPosition = function (inPosition) {
  this.rposition = this.mStartPosition + inPosition;
};

PDFRStreamForBuffer.prototype.setPositionFromEnd = function (inPosition) {
  this.rposition = this.fileSize - inPosition;
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
