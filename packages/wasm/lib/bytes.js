/** UTF-8 encoder shared by WASM byte utilities. */
export var encoder = new TextEncoder();

/**
 * Copies synchronous byte input into a new Uint8Array.
 * @param {ByteSource} value - Bytes, an ArrayBuffer, or a PDFRStreamForBuffer.
 * @param {string} [label="Bytes"] - Name used in error messages.
 * @returns {Uint8Array} A copy of the bytes.
 * @throws {TypeError} If `value` is a Blob or File, which needs the Async API, or is not bytes.
 */
export function normalizeBytes(value, label = "Bytes") {
  if (value instanceof PDFRStreamForBuffer) return new Uint8Array(value.buffer);
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    throw new TypeError(
      `${label} Blob/File input is asynchronous; use the corresponding Async API`,
    );
  }
  throw new TypeError(`${label} must be a Uint8Array or ArrayBuffer`);
}

/**
 * Converts an array of byte values to bytes, as native accepts for string
 * and stream writes. Other values are returned unchanged.
 * @param {*} value - Candidate value.
 * @param {string} label - Name used in error messages.
 * @returns {*} A new Uint8Array for an array, otherwise `value`.
 * @throws {TypeError} If an array item is not an integer from 0 to 255.
 */
export function byteArrayToBytes(value, label) {
  if (!Array.isArray(value)) return value;
  if (
    !value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  ) {
    throw new TypeError(`${label} bytes must be integers from 0 to 255`);
  }
  return Uint8Array.from(value);
}

/**
 * Normalizes byte input, awaiting Blob and File data when necessary.
 * @async
 * @param {AsyncByteSource} value - Bytes or a Blob-like object.
 * @param {string} label - Name used in error messages.
 * @returns {Promise<Uint8Array>} A copy of the bytes.
 * @throws {TypeError} If `value` is not a supported byte source.
 */
export async function normalizeBytesAsync(value, label) {
  // Accept any BlobLike (Blob, File, or a structural equivalent), as typed.
  if (
    value &&
    typeof value === "object" &&
    !(value instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(value) &&
    typeof value.arrayBuffer === "function"
  ) {
    return normalizeBytes(await value.arrayBuffer(), label);
  }
  return normalizeBytes(value, label);
}

/**
 * Browser-safe random-access equivalent of PDFRStreamForBuffer.
 *
 * @param {Uint8Array|ArrayBuffer} bytes Source bytes to read.
 */
export class PDFRStreamForBuffer {
  constructor(bytes) {
    this.buffer = normalizeBytes(bytes, "PDFRStreamForBuffer input");
    this.rposition = 0;
    this.fileSize = this.buffer.length;
    this.mStartPosition = 0;
  }

  /**
   * Reads bytes from the current position and advances by `amount`, as
   * native does, even past the end.
   *
   * @param {number} amount Number of bytes to read.
   * @returns {Uint8Array} A copy of at most `amount` bytes.
   * @throws {RangeError} If `amount` is not a non-negative integer.
   */
  read(amount) {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new RangeError("read requires a non-negative integer");
    }
    var result = this.buffer.slice(this.rposition, this.rposition + amount);
    this.rposition += amount;
    return result;
  }

  /**
   * Reports whether unread bytes remain.
   *
   * @returns {boolean} Whether the position is before the end.
   */
  notEnded() {
    return this.rposition < this.fileSize;
  }

  /**
   * Moves to a position relative to the start position, clamped to the bytes.
   *
   * @param {number} position Offset from the start position.
   * @returns {void}
   * @throws {TypeError} If `position` is not an integer.
   */
  setPosition(position) {
    if (!Number.isInteger(position))
      throw new TypeError("Position must be an integer");
    this.rposition = Math.min(
      Math.max(this.mStartPosition + position, 0),
      this.fileSize,
    );
  }

  /**
   * Moves to a position counted back from the end, clamped to the bytes.
   *
   * @param {number} position Offset from the end.
   * @returns {void}
   * @throws {TypeError} If `position` is not an integer.
   */
  setPositionFromEnd(position) {
    if (!Number.isInteger(position))
      throw new TypeError("Position must be an integer");
    this.rposition = Math.min(
      Math.max(this.fileSize - position, 0),
      this.fileSize,
    );
  }

  /**
   * Advances the position without reading; not clamped, as in native.
   *
   * @param {number} amount Number of bytes to skip.
   * @returns {void}
   * @throws {TypeError} If `amount` is not an integer.
   */
  skip(amount) {
    if (!Number.isInteger(amount))
      throw new TypeError("Skip amount must be an integer");
    this.rposition += amount;
  }

  /**
   * Reads the position relative to the start position.
   *
   * @returns {number} The current offset.
   */
  getCurrentPosition() {
    return this.rposition - this.mStartPosition;
  }

  /**
   * Sets the origin that `setPosition()` and `getCurrentPosition()` use.
   *
   * @param {number} position Absolute start offset.
   * @returns {void}
   * @throws {TypeError} If `position` is not an integer.
   */
  moveStartPosition(position) {
    if (!Number.isInteger(position))
      throw new TypeError("Position must be an integer");
    this.mStartPosition = position;
  }
}

/**
 * Browser-safe accumulating equivalent of PDFWStreamForBuffer.
 *
 * @returns {PDFWStreamForBuffer} An empty byte stream.
 */
export class PDFWStreamForBuffer {
  constructor() {
    this.chunks = [];
    this.joined = new Uint8Array();
    this.position = 0;
  }

  /**
   * The bytes written so far. Chunks are joined on first access instead of on
   * every write.
   *
   * @returns {Uint8Array} The written bytes.
   */
  get buffer() {
    if (this.chunks.length === 0) return this.joined;
    var length = this.joined.length;
    for (var pending of this.chunks) length += pending.length;
    var next = new Uint8Array(length);
    next.set(this.joined);
    var offset = this.joined.length;
    for (var chunk of this.chunks) {
      next.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];
    this.joined = next;
    return next;
  }

  /**
   * Replaces the collected bytes.
   *
   * @param {Uint8Array} value The new contents.
   */
  set buffer(value) {
    this.chunks = [];
    this.joined = value;
  }

  /**
   * Appends a copy of the bytes.
   *
   * @param {Uint8Array|ArrayBuffer|PDFRStreamForBuffer|number[]} bytes Bytes
   *   to append, or an array of byte values as native accepts.
   * @returns {number} Number of bytes written.
   * @throws {TypeError} If `bytes` is not a supported byte source or an array
   *   item is not an integer from 0 to 255.
   */
  write(bytes) {
    bytes = normalizeBytes(
      byteArrayToBytes(bytes, "PDFWStreamForBuffer input"),
      "PDFWStreamForBuffer input",
    );
    if (bytes.length === 0) return 0;
    this.chunks.push(bytes);
    this.position += bytes.length;
    return bytes.length;
  }

  /**
   * Reads the number of bytes written so far.
   *
   * @returns {number} The write position.
   */
  getCurrentPosition() {
    return this.position;
  }

  /**
   * Copies the written bytes.
   *
   * @returns {Uint8Array} An owned copy of the bytes.
   */
  toUint8Array() {
    return new Uint8Array(this.buffer);
  }

  /**
   * Copies the written bytes into a new buffer.
   *
   * @returns {ArrayBuffer} An owned buffer of the bytes.
   */
  toArrayBuffer() {
    return this.toUint8Array().buffer;
  }

  /**
   * Wraps the written bytes in a Blob.
   *
   * @param {string} [type="application/pdf"] Blob media type.
   * @returns {Blob} A Blob of the bytes.
   * @throws {Error} If the environment has no Blob.
   */
  toBlob(type = "application/pdf") {
    if (typeof Blob === "undefined") throw new Error("Blob is unavailable");
    return new Blob([this.buffer], { type });
  }
}

/** Compatibility byte reader. */
export class ByteReader extends PDFRStreamForBuffer {}
/** Compatibility positioned byte reader. */
export class ByteReaderWithPosition extends PDFRStreamForBuffer {}
/** Compatibility byte writer. */
export class ByteWriter extends PDFWStreamForBuffer {}
/** Compatibility positioned byte writer. */
export class ByteWriterWithPosition extends PDFWStreamForBuffer {}
