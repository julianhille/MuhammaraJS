export var encoder = new TextEncoder();

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

export async function normalizeBytesAsync(value, label) {
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return normalizeBytes(await value.arrayBuffer(), label);
  }
  return normalizeBytes(value, label);
}

/** Browser-safe random-access equivalent of PDFRStreamForBuffer. */
export class PDFRStreamForBuffer {
  constructor(bytes) {
    this.buffer = normalizeBytes(bytes, "PDFRStreamForBuffer input");
    this.rposition = 0;
    this.fileSize = this.buffer.length;
    this.mStartPosition = 0;
  }

  read(amount) {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new RangeError("read requires a non-negative integer");
    }
    var result = Array.from(
      this.buffer.subarray(this.rposition, this.rposition + amount),
    );
    this.rposition += amount;
    return result;
  }

  notEnded() {
    return this.rposition < this.fileSize;
  }

  setPosition(position) {
    if (!Number.isInteger(position))
      throw new TypeError("Position must be an integer");
    this.rposition = this.mStartPosition + position;
  }

  setPositionFromEnd(position) {
    if (!Number.isInteger(position))
      throw new TypeError("Position must be an integer");
    this.rposition = this.fileSize - position;
  }

  skip(amount) {
    if (!Number.isInteger(amount))
      throw new TypeError("Skip amount must be an integer");
    this.rposition += amount;
  }

  getCurrentPosition() {
    return this.rposition - this.mStartPosition;
  }

  moveStartPosition(position) {
    if (!Number.isInteger(position))
      throw new TypeError("Position must be an integer");
    this.mStartPosition = position;
  }
}

/** Browser-safe accumulating equivalent of PDFWStreamForBuffer. */
export class PDFWStreamForBuffer {
  constructor() {
    this.buffer = new Uint8Array();
    this.position = 0;
  }

  write(bytes) {
    bytes = normalizeBytes(bytes, "PDFWStreamForBuffer input");
    if (bytes.length === 0) return 0;
    var next = new Uint8Array(this.buffer.length + bytes.length);
    next.set(this.buffer);
    next.set(bytes, this.buffer.length);
    this.buffer = next;
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

export class ByteReader extends PDFRStreamForBuffer {}
export class ByteReaderWithPosition extends PDFRStreamForBuffer {}
export class ByteWriter extends PDFWStreamForBuffer {}
export class ByteWriterWithPosition extends PDFWStreamForBuffer {}
