// Reads and inserts custom sections in a finished WebAssembly binary.
// `emcc` runs wasm-opt, which moves custom sections to the end of the module,
// so the license section is added after linking instead of through a flag.

var magic = [0x00, 0x61, 0x73, 0x6d];
var version = [0x01, 0x00, 0x00, 0x00];
var encoder = new TextEncoder();
var decoder = new TextDecoder("utf-8", { fatal: true });

/** Name of the custom section that carries the third-party licenses. */
export var licenseSectionName = "license";

/**
 * Encodes an unsigned LEB128 integer.
 * @param {number} value - Non-negative safe integer below 2^32.
 * @returns {number[]} The encoded bytes.
 * @throws {RangeError} If the value does not fit a wasm u32.
 */
export function encodeU32(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError(`Not a wasm u32: ${value}`);
  }
  var bytes = [];
  do {
    var byte = value & 0x7f;
    value = Math.floor(value / 128);
    bytes.push(value ? byte | 0x80 : byte);
  } while (value);
  return bytes;
}

/**
 * Decodes an unsigned LEB128 integer.
 * @param {Uint8Array} bytes - Module bytes.
 * @param {number} offset - Position of the first byte.
 * @returns {{value: number, next: number}} The value and the following offset.
 * @throws {Error} If the integer is truncated or longer than five bytes.
 */
function decodeU32(bytes, offset) {
  var value = 0;
  for (var index = 0; index < 5; index += 1) {
    if (offset + index >= bytes.length) {
      throw new Error("Truncated LEB128 integer in wasm module");
    }
    var byte = bytes[offset + index];
    value += (byte & 0x7f) * 2 ** (7 * index);
    if (!(byte & 0x80)) {
      if (value > 0xffffffff) throw new Error("LEB128 integer exceeds u32");
      return { value, next: offset + index + 1 };
    }
  }
  throw new Error("LEB128 integer exceeds five bytes");
}

/**
 * Lists the sections of a version-1 WebAssembly module.
 * @param {Uint8Array} bytes - Module bytes.
 * @returns {{id: number, start: number, contentStart: number, end: number, name?: string}[]}
 * Each section's id, byte range, and, for custom sections, its name.
 * @throws {Error} If the bytes are not a well-formed version-1 module.
 */
export function readSections(bytes) {
  if (
    bytes.length < 8 ||
    magic.some((byte, index) => bytes[index] !== byte) ||
    version.some((byte, index) => bytes[4 + index] !== byte)
  ) {
    throw new Error("Not a version-1 WebAssembly module");
  }
  var sections = [];
  var offset = 8;
  while (offset < bytes.length) {
    var id = bytes[offset];
    var size = decodeU32(bytes, offset + 1);
    var end = size.next + size.value;
    if (end > bytes.length) throw new Error("Truncated wasm section");
    var section = { id, start: offset, contentStart: size.next, end };
    if (id === 0) {
      var nameLength = decodeU32(bytes, size.next);
      if (nameLength.next + nameLength.value > end) {
        throw new Error("Custom section name exceeds its section");
      }
      section.name = decoder.decode(
        bytes.subarray(nameLength.next, nameLength.next + nameLength.value),
      );
      section.payloadStart = nameLength.next + nameLength.value;
    }
    sections.push(section);
    offset = end;
  }
  return sections;
}

/**
 * Encodes a custom section.
 * @param {string} name - Section name.
 * @param {Uint8Array} payload - Section payload.
 * @returns {Uint8Array} The complete section, id and size included.
 */
export function encodeCustomSection(name, payload) {
  var nameBytes = encoder.encode(name);
  var content = [...encodeU32(nameBytes.length), ...nameBytes];
  var size = encodeU32(content.length + payload.length);
  var section = new Uint8Array(
    1 + size.length + content.length + payload.length,
  );
  section.set([0, ...size, ...content]);
  section.set(payload, 1 + size.length + content.length);
  return section;
}

/**
 * Inserts the license text as a custom section directly after the header.
 * @param {Uint8Array} bytes - A version-1 module without a license section.
 * @param {string} text - License text, stored as UTF-8.
 * @returns {Uint8Array} The new module bytes.
 * @throws {Error} If the module is malformed or already has a license section.
 */
export function insertLicenseSection(bytes, text) {
  if (
    readSections(bytes).some((section) => section.name === licenseSectionName)
  ) {
    throw new Error(`Module already has a "${licenseSectionName}" section`);
  }
  var section = encodeCustomSection(licenseSectionName, encoder.encode(text));
  var output = new Uint8Array(bytes.length + section.length);
  output.set(bytes.subarray(0, 8));
  output.set(section, 8);
  output.set(bytes.subarray(8), 8 + section.length);
  return output;
}

/**
 * Returns the payloads of every custom section with the given name.
 * @param {Uint8Array} bytes - Module bytes.
 * @param {string} name - Section name.
 * @returns {Uint8Array[]} The payloads, in module order.
 */
export function customSections(bytes, name) {
  return readSections(bytes)
    .filter((section) => section.name === name)
    .map((section) => bytes.subarray(section.payloadStart, section.end));
}
