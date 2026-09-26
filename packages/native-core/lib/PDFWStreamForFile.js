var fs = require("fs");

/*
    PDFWStreamForFile is an implementation of a write stream using the supplied file path.
*/

function PDFWStreamForFile(inPath) {
  this.ws = fs.createWriteStream(inPath);
  this.position = 0;
  this.path = inPath;
}

PDFWStreamForFile.prototype.write = function (inBytes) {
  // Arrays of byte values are still accepted from direct callers.
  if (!Buffer.isBuffer(inBytes)) inBytes = Buffer.from(inBytes);
  if (inBytes.length > 0) {
    this.ws.write(inBytes);
    this.position += inBytes.length;
    return inBytes.length;
  } else return 0;
};

PDFWStreamForFile.prototype.getCurrentPosition = function () {
  return this.position;
};

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
