// Validation of Recipe drawing options shared by shapes, text, and images.

/**
 * Read a `rotation` option in degrees. A numeric string counts as its number.
 * @param {*} value - The option value.
 * @returns {number|undefined} The rotation, or undefined when omitted or null.
 * @throws {TypeError} If the value is not a finite number: it used to write
 *   NaN transformation matrices.
 */
function rotationOption(value) {
  if (value === undefined || value === null) return undefined;
  const rotation = optionNumber(value);
  if (!Number.isFinite(rotation)) {
    throw new TypeError("rotation must be a finite number");
  }
  return rotation;
}

/**
 * Read a `miterLimit` option. A numeric string counts as its number.
 * @param {*} value - The option value.
 * @returns {number|undefined} The miter limit, or undefined when omitted or
 *   null.
 * @throws {RangeError} If the value is not a number of at least 1, which PDF
 *   requires.
 */
function miterLimitOption(value) {
  if (value === undefined || value === null) return undefined;
  const miterLimit = optionNumber(value);
  if (!(miterLimit >= 1) || !Number.isFinite(miterLimit)) {
    throw new RangeError("miterLimit must be a number of at least 1");
  }
  return miterLimit;
}

/**
 * The number of a numeric option: a number, or a string holding one.
 * @param {*} value - The option value.
 * @returns {number} The number; NaN for any other value.
 */
function optionNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

module.exports = { miterLimitOption, rotationOption };
