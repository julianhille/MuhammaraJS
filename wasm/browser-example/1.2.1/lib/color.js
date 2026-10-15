import { cssColors } from "./css-colors.js";

/**
 * Converts a named, hexadecimal, RGB, or numeric color to a 24-bit integer.
 * @param {ColorValue} color - Number, `[r, g, b]`, `#rrggbb`, or a CSS color name in any case.
 * @returns {number} The color as `0xRRGGBB`; black when `color` is `undefined` or `null`.
 * @throws {TypeError} If a string is not a CSS color name or `#rrggbb`.
 */
export function colorValue(color) {
  if (typeof color === "number") {
    return color;
  }
  if (Array.isArray(color) && color.length === 3) {
    return (color[0] << 16) | (color[1] << 8) | color[2];
  }
  if (color === undefined || color === null) {
    return 0;
  }
  if (typeof color === "string") {
    var name = color.toLowerCase();
    if (Object.hasOwn(cssColors, name)) return cssColors[name];
    if (/^#[0-9a-f]{6}$/i.test(color))
      return Number.parseInt(color.slice(1), 16);
  }
  throw new TypeError(
    "Colors must be a 24-bit number, a color name, or a #rrggbb string",
  );
}
