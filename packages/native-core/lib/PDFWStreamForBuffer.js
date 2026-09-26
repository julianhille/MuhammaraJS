/*
    PDFWStreamForBuffer is an implementation of a write stream that collects
    the written bytes in memory. Read the result from its `buffer` property.
*/
/**
 * Creates a write stream that collects the bytes in memory.
 * @constructor
 */
function PDFWStreamForBuffer() {
  this.chunks = [];
  this.joined = null;
  this.position = 0;
}

Object.defineProperty(PDFWStreamForBuffer.prototype, "buffer", {
  /**
   * The bytes written so far, or null before the first write. Chunks are
   * joined on first access instead of on every write.
   * @returns {Buffer|null} The written bytes.
   */
  get: function () {
    if (this.chunks.length === 0) return this.joined;
    this.joined = this.joined
      ? Buffer.concat([this.joined].concat(this.chunks))
      : Buffer.concat(this.chunks);
    this.chunks = [];
    return this.joined;
  },
  /**
   * Replaces the collected bytes.
   * @param {Buffer|null} value - The new contents.
   */
  set: function (value) {
    this.chunks = [];
    this.joined = value;
  },
});

/**
 * Collects a copy of the bytes.
 * @param {Buffer|Uint8Array|number[]} inBytes - The bytes to write.
 * @returns {number} The number of bytes written.
 */
PDFWStreamForBuffer.prototype.write = function (inBytes) {
  if (inBytes.length > 0) {
    // Copy, so a caller reusing its buffer cannot change collected output,
    // and so arrays of byte values keep working.
    this.chunks.push(Buffer.from(inBytes));
    this.position += inBytes.length;
    return inBytes.length;
  }

  return 0;
};

PDFWStreamForBuffer.prototype.getCurrentPosition = function () {
  return this.position;
};

module.exports = PDFWStreamForBuffer;
