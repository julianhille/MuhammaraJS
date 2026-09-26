var fs = require("fs");

/*
    PDFWStreamForFile is an implementation of a write stream using the supplied file path.
*/

/**
 * Creates a write stream to a file, replacing an existing one.
 * @constructor
 * @param {string} inPath - The file path.
 */
function PDFWStreamForFile(inPath) {
  this.ws = fs.createWriteStream(inPath);
  this.position = 0;
  this.path = inPath;
}

/**
 * Writes bytes to the file.
 * @param {Buffer|number[]} inBytes - The bytes to write.
 * @returns {number} The number of bytes written.
 */
PDFWStreamForFile.prototype.write = function (inBytes) {
  // Arrays of byte values are still accepted from direct callers.
  if (!Buffer.isBuffer(inBytes)) inBytes = Buffer.from(inBytes);
  if (inBytes.length > 0) {
    this.ws.write(inBytes);
    this.position += inBytes.length;
    return inBytes.length;
  } else return 0;
};

/**
 * Returns the number of bytes written so far.
 * @returns {number} The current byte offset.
 */
PDFWStreamForFile.prototype.getCurrentPosition = function () {
  return this.position;
};

/**
 * Flushes and closes the file.
 * @param {Function} [inCallback] - Called once the file is closed.
 * @returns {void}
 */
PDFWStreamForFile.prototype.close = function (inCallback) {
  if (this.ws) {
    var self = this;

    this.ws.end(function () {
      self.ws = null;
      if (inCallback) inCallback();
    });
  } else {
    if (inCallback) inCallback();
  }
};

module.exports = PDFWStreamForFile;
