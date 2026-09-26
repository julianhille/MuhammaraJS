/*
    PDFStreamForResponse is an implementation of a write stream that writes directly to an HTTP response.
    Using this stream frees the user from having to create a PDF file on disk when generating on-demand PDFs
*/
/**
 * Creates a write stream that writes to an HTTP response.
 * @constructor
 * @param {{write: function(Buffer): *}} inResponse - The response, or any
 *   object with a write method.
 */
function PDFStreamForResponse(inResponse) {
  this.response = inResponse;
  this.position = 0;
}

PDFStreamForResponse.prototype.write = function (inBytes) {
  // Arrays of byte values are still accepted from direct callers.
  if (!Buffer.isBuffer(inBytes)) inBytes = Buffer.from(inBytes);
  if (inBytes.length > 0) {
    this.response.write(inBytes);
    this.position += inBytes.length;
    return inBytes.length;
  } else return 0;
};

PDFStreamForResponse.prototype.getCurrentPosition = function () {
  return this.position;
};

module.exports = PDFStreamForResponse;
