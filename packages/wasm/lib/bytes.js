/** UTF-8 encoder shared by WASM byte utilities. */
export var encoder = new TextEncoder();

/** Normalizes supported synchronous byte inputs into an owned Uint8Array copy. */
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

/** Normalizes byte inputs, awaiting Blob and File data when necessary. */
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
   * @param {Uint8Array|ArrayBuffer|PDFRStreamForBuffer} bytes Bytes to append.
   * @returns {number} Number of bytes written.
   * @throws {TypeError} If `bytes` is not a supported byte source.
   */
  write(bytes) {
    bytes = normalizeBytes(bytes, "PDFWStreamForBuffer input");
    if (bytes.length === 0) return 0;
    this.chunks.push(bytes);
    this.position += bytes.length;
    return bytes.length;
  }

  getCurrentPosition() {
    return this.position;
  }

  toUint8Array() {
    return new Uint8Array(this.buffer);
  }

  toArrayBuffer() {
    return this.toUint8Array().buffer;
  }

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
