/** Built-in Recipe colors grouped by color space. */
export var knownColors = {
  rgb: { red: "ff0000", green: "00ff00", blue: "0000ff" },
  cmyk: {
    cyan: "ff000000",
    magenta: "00ff0000",
    yellow: "0000ff00",
    black: "000000ff",
  },
  gray: { white: "ff", black: "00", grey: "00" },
  separation: {
    cyan: "ff000000",
    magenta: "00ff0000",
    yellow: "0000ff00",
    black: "000000ff",
  },
};

function hex(value) {
  if (Array.isArray(value))
    return value
      .map((part) =>
        Math.max(0, Math.min(255, Math.round(part)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  if (typeof value !== "string") return "";
  if (value.startsWith("%"))
    return hex(
      value
        .slice(1)
        .split(",")
        .map((part) => Number(part) * 2.55),
    );
  return value.replace(/^#/, "");
}

/** Resolves a Recipe color value to a native color-space model. */
export function colorModel(recipe, value, options = {}) {
  var colorspace = options.colorspace || recipe.options.colorspace || "";
  var name = "";
  if (
    typeof value === "string" &&
    !value.startsWith("#") &&
    !value.startsWith("%")
  ) {
    name = value;
    value = (recipe.knownColors[colorspace || "rgb"] || {})[value] || value;
  }
  var code = hex(value || "");
  if (!colorspace)
    colorspace = { 2: "gray", 6: "rgb", 8: "cmyk" }[code.length] || "rgb";
  var expected = { gray: 2, rgb: 6, cmyk: 8, separation: undefined }[
    colorspace
  ];
  if (!(colorspace in recipe.knownColors))
    throw new TypeError(`Unknown colorspace: ${colorspace}`);
  if (colorspace === "separation") {
    // The Recipe native bridge cannot create Separation resource dictionaries.
    throw new Error(
      "Recipe separation colors are unsupported in WebAssembly; use low-level writer resources.",
    );
  }
  if (code.length !== expected || !/^[0-9a-f]+$/i.test(code)) {
    code = { gray: "00", rgb: "1777d1", cmyk: "ff000000" }[colorspace];
  }
  return {
    colorspace,
    values: code.match(/../g).map((part) => Number.parseInt(part, 16) / 255),
    name,
  };
}

/** Creates Recipe color registration methods. */
export function createColorMethods() {
  return {
    chroma: function (name, value, colorspace = "") {
      if (!name) return this;
      if (name === "!load")
        throw new Error(
          "Recipe chroma !load is unsupported in WebAssembly; register colors explicitly.",
        );
      var code = hex(value);
      if (![2, 6, 8].includes(code.length) || !/^[0-9a-f]+$/i.test(code))
        throw new TypeError(
          "Color value has incorrect size for gray, rgb, or cmyk colorspaces",
        );
      colorspace =
        colorspace || { 2: "gray", 6: "rgb", 8: "cmyk" }[code.length];
      if (colorspace === "separation") {
        throw new Error(
          "Recipe separation colors are unsupported in WebAssembly; use low-level writer resources.",
        );
      }
      if (!(colorspace in this.knownColors))
        throw new TypeError(`Unknown colorspace: ${colorspace}`);
      this.knownColors[colorspace][name] = code;
      return this;
    },
  };
}
