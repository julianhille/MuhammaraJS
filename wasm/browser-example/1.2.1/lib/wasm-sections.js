// Reads the sections of a WebAssembly binary without compiling it.

var magic = [0x00, 0x61, 0x73, 0x6d];
var version = [0x01, 0x00, 0x00, 0x00];
var decoder = new TextDecoder("utf-8", { fatal: true });

/** Name of the custom section that carries the third-party licenses. */
export var licenseSectionName = "license";

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
