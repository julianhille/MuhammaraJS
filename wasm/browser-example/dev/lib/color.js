/** Converts a named, hexadecimal, RGB, or numeric color to a 24-bit integer. */
export function colorValue(color) {
  if (typeof color === "number") {
    return color;
  }
  if (Array.isArray(color) && color.length === 3) {
    return (color[0] << 16) | (color[1] << 8) | color[2];
  }
  var named = {
    black: "#000000",
    blue: "#0000ff",
    DarkMagenta: "#8b008b",
    green: "#008000",
    red: "#ff0000",
    white: "#ffffff",
    yellow: "#ffff00",
  };
  color = named[color] || color;
  var value = (color || "#000000").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) {
    throw new TypeError("Colors must be a 24-bit number or a #rrggbb string");
  }
  return Number.parseInt(value, 16);
}
