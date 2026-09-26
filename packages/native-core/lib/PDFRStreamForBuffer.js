/*
    PDFRStreamForBuffer is an implementation of a read stream using a supplied array

    @author Luciano Júnior
*/

/**
 * Creates a read stream over bytes in memory.
 * @constructor
 * @param {Buffer|Uint8Array} buffer - The bytes to read; not copied.
 */
function PDFRStreamForBuffer(buffer) {
  this.buffer = buffer;
  this.rposition = 0;
  this.fileSize = this.buffer.length;
  this.mStartPosition = 0;
}

/**
 * Reads the next bytes and advances the position by the amount read.
 * @param {number} inAmount - The maximum number of bytes to read.
 * @returns {Buffer} The bytes read; shorter than requested at the end.
 */
PDFRStreamForBuffer.prototype.read = function (inAmount) {
  // Copy, so callers cannot change the source through the returned chunk.
  var bytes = Buffer.from(
    this.buffer.subarray(this.rposition, this.rposition + inAmount),
  );
  this.rposition += inAmount;
  return bytes;
};

/**
 * Tells whether bytes remain after the current position.
 * @returns {boolean} True while the end has not been reached.
 */
PDFRStreamForBuffer.prototype.notEnded = function () {
  return this.rposition < this.fileSize;
};

/**
 * Moves to a position relative to the start position, clamped to the data.
 * @param {number} inPosition - The byte offset from the start position.
 * @returns {void}
 */
PDFRStreamForBuffer.prototype.setPosition = function (inPosition) {
  this.rposition = Math.min(
    Math.max(this.mStartPosition + inPosition, 0),
    this.fileSize,
  );
};

/**
 * Moves to a position counted back from the end, clamped to the data.
 * @param {number} inPosition - The number of bytes before the end.
 * @returns {void}
 */
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
