import { RecipeColorSpace } from "../value-sets.js";
/** Built-in Recipe colors grouped by color space. */
export var knownColors = {
  [RecipeColorSpace.RGB]: { red: "ff0000", green: "00ff00", blue: "0000ff" },
  [RecipeColorSpace.CMYK]: {
    cyan: "ff000000",
    magenta: "00ff0000",
    yellow: "0000ff00",
    black: "000000ff",
  },
  [RecipeColorSpace.GRAY]: { white: "ff", black: "00", grey: "00" },
  [RecipeColorSpace.SEPARATION]: {
    cyan: "ff000000",
    magenta: "00ff0000",
    yellow: "0000ff00",
    black: "000000ff",
  },
};

/**
 * Converts a Recipe color to its hex digits without a prefix.
 * @param {RecipeColor} value - `[r, g, b]` or `[c, m, y, k]` from 0 to 255, `#hex`, `%hex`, or a number.
 * @returns {string} Hex digits; empty for unsupported values.
 */
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

/**
 * Infers a device color space from the digit count of a hex color code.
 * @param {string} code - Hex digits without a prefix.
 * @returns {string|undefined} Gray for 2 digits, RGB for 6, CMYK for 8.
 */
function colorSpaceForCode(code) {
  return {
    2: RecipeColorSpace.GRAY,
    6: RecipeColorSpace.RGB,
    8: RecipeColorSpace.CMYK,
  }[code.length];
}

/**
 * Resolves a Recipe color value to a native color-space model.
 * @param {Recipe} recipe - Recipe instance with known colors.
 * @param {RecipeColor} value - Color value or registered name.
 * @param {object} [options={}] - Options with `colorspace`.
 * @returns {{colorspace: DeviceColorSpace, values: number[]}} Components from 0 to 1.
 * @throws {TypeError} If the color space is unknown.
 * @throws {Error} If a Separation color space is requested.
 */
export function colorModel(recipe, value, options = {}) {
  var colorspace = options.colorspace || recipe.options.colorspace || "";
  var name = "";
  if (
    typeof value === "string" &&
    !value.startsWith("#") &&
    !value.startsWith("%")
  ) {
    name = value;
    value =
      (recipe.knownColors[colorspace || RecipeColorSpace.RGB] || {})[value] ||
      value;
  }
  var code = hex(value || "");
  if (!colorspace) colorspace = colorSpaceForCode(code) || RecipeColorSpace.RGB;
  var expected = {
    [RecipeColorSpace.GRAY]: 2,
    [RecipeColorSpace.RGB]: 6,
    [RecipeColorSpace.CMYK]: 8,
  }[colorspace];
  if (!(colorspace in recipe.knownColors))
    throw new TypeError(`Unknown colorspace: ${colorspace}`);
  if (colorspace === RecipeColorSpace.SEPARATION) {
    // The Recipe native bridge cannot create Separation resource dictionaries.
    throw new Error(
      "Recipe separation colors are unsupported in WebAssembly; use low-level writer resources.",
    );
  }
  if (code.length !== expected || !/^[0-9a-f]+$/i.test(code)) {
    code = {
      [RecipeColorSpace.GRAY]: "00",
      [RecipeColorSpace.RGB]: "1777d1",
      [RecipeColorSpace.CMYK]: "ff000000",
    }[colorspace];
  }
  return {
    colorspace,
    values: code.match(/../g).map((part) => Number.parseInt(part, 16) / 255),
    name,
  };
}

/**
 * Creates Recipe color registration methods.
 * @returns {object} Methods mixed into Recipe.prototype.
 */
export function createColorMethods() {
  return {
    /**
     * Registers a named color for later use by Recipe drawing methods.
     *
     * Array components use values from 0 through 255. Hex strings may start
     * with `#`, and percentage strings may start with `%`. An empty name is a
     * no-op. WebAssembly does not support loading color files or Separation
     * color resources.
     *
     * @name chroma
     * @function
     * @memberof Recipe#
     * @param {string} name - The name to register.
     * @param {RecipeColor} value - A gray, RGB, or CMYK color value.
     * @param {RecipeColorSpace} [colorspace] - The color space, inferred from the value when omitted.
     * @returns {Recipe} The recipe instance.
     * @throws {TypeError} If the color value has an invalid size or the color space is unknown.
     * @throws {Error} If `name` is `!load` or the Separation color space is requested.
     */
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
      colorspace = colorspace || colorSpaceForCode(code);
      if (colorspace === RecipeColorSpace.SEPARATION) {
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
