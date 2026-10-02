// Reads and inserts custom sections in a finished WebAssembly binary.
// `emcc` runs wasm-opt, which moves custom sections to the end of the module,
// so the license section is added after linking instead of through a flag.

import {
  customSections,
  licenseSectionName,
  readSections,
} from "../lib/wasm-sections.js";

export { customSections, licenseSectionName, readSections };

var encoder = new TextEncoder();

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
