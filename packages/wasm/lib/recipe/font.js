function fontStyle(options = {}) {
  return (options.bold || options.isBold) &&
    (options.italic || options.isItalic)
    ? "bi"
    : options.italic || options.isItalic
      ? "i"
      : options.bold || options.isBold
        ? "b"
        : "r";
}

export function registerFont(fonts, name, path, type = "regular") {
  if (typeof name !== "string" || !name) {
    throw new TypeError("Font names must be non-empty strings");
  }
  var family = fonts.get(name.toLowerCase()) || {};
  var style =
    { bold: "b", b: "b", italic: "i", i: "i", "bold-italic": "bi", bi: "bi" }[
      String(type).toLowerCase()
    ] || "r";
  var previous = family[style];
  family[style] = path;
  fonts.set(name.toLowerCase(), family);
  return previous;
}

export function getFont(fonts, options = {}) {
  var family = fonts.get(String(options.font || "").toLowerCase());
  if (!family) throw new Error(`Unknown font: ${options.font || "(none)"}`);
  return (
    family[fontStyle(options)] || family.r || family.b || family.i || family.bi
  );
}
