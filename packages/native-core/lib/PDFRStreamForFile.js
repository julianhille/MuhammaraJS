var fs = require("fs");
/*
    PDFRStreamForFile is an implementation of a read stream using the supplied file path.
*/

/**
 * Opens a file for reading.
 * @constructor
 * @param {string} inPath - The file path.
 * @throws {Error} If the file cannot be opened or read.
 */
function PDFRStreamForFile(inPath) {
  this.rs = fs.openSync(inPath, "r");
  this.path = inPath;
  this.rposition = 0;
  this.fileSize = fs.statSync(inPath)["size"];
  this.mStartPosition = 0;
}

/**
 * Reads the next bytes and advances the position by the amount read.
 * @param {number} inAmount - The maximum number of bytes to read.
 * @returns {Buffer} The bytes read; shorter than requested at the end.
 */
PDFRStreamForFile.prototype.read = function (inAmount) {
  var buffer = Buffer.alloc(inAmount);
  var bytesRead = fs.readSync(this.rs, buffer, 0, inAmount, this.rposition);
  this.rposition += bytesRead;
  return buffer.subarray(0, bytesRead);
};

/**
 * Tells whether bytes remain after the current position.
 * @returns {boolean} True while the end has not been reached.
 */
PDFRStreamForFile.prototype.notEnded = function () {
  return this.rposition < this.fileSize;
};

/**
 * Moves to a position relative to the start position, clamped to the data.
 * @param {number} inPosition - The byte offset from the start position.
 * @returns {void}
 */
PDFRStreamForFile.prototype.setPosition = function (inPosition) {
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
PDFRStreamForFile.prototype.setPositionFromEnd = function (inPosition) {
  this.rposition = Math.min(
    Math.max(this.fileSize - inPosition, 0),
    this.fileSize,
  );
};

/**
 * Advances the position without reading.
 * @param {number} inAmount - The number of bytes to skip.
 * @returns {void}
 */
PDFRStreamForFile.prototype.skip = function (inAmount) {
  this.rposition += inAmount;
};

PDFRStreamForFile.prototype.getCurrentPosition = function () {
  return this.rposition - this.mStartPosition;
};

PDFRStreamForFile.prototype.moveStartPosition = function (inPosition) {
  this.mStartPosition = inPosition;
};

function noop() {}

PDFRStreamForFile.prototype.close = function (inCallback) {
  fs.close(this.rs, inCallback ? inCallback : noop);
};

module.exports = PDFRStreamForFile;
