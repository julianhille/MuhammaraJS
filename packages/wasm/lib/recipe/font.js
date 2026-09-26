import { RecipeFontStyle } from "../value-sets.js";
function fontStyle(options = {}) {
  return (options.bold || options.isBold) &&
    (options.italic || options.isItalic)
    ? RecipeFontStyle.BI
    : options.italic || options.isItalic
      ? RecipeFontStyle.I
      : options.bold || options.isBold
        ? RecipeFontStyle.B
        : RecipeFontStyle.R;
}

/** Registry key for every RecipeFontStyle spelling. */
var FONT_STYLE_KEYS = {
  [RecipeFontStyle.REGULAR]: RecipeFontStyle.R,
  [RecipeFontStyle.R]: RecipeFontStyle.R,
  [RecipeFontStyle.BOLD]: RecipeFontStyle.B,
  [RecipeFontStyle.B]: RecipeFontStyle.B,
  [RecipeFontStyle.ITALIC]: RecipeFontStyle.I,
  [RecipeFontStyle.I]: RecipeFontStyle.I,
  [RecipeFontStyle.BOLD_ITALIC]: RecipeFontStyle.BI,
  [RecipeFontStyle.BI]: RecipeFontStyle.BI,
};

/**
 * Resolves a font style spelling, in any letter case, to its registry key.
 * @param {*} type - A RecipeFontStyle value.
 * @returns {string} `r`, `b`, `i`, or `bi`; unknown styles resolve to `r`.
 */
export function fontStyleKey(type) {
  return FONT_STYLE_KEYS[String(type).toLowerCase()] || RecipeFontStyle.R;
}

/**
 * Registers a font path for a family and style.
 *
 * @returns {string|undefined} The previously registered path. The caller owns
 * cleanup of that replaced path.
 */
export function registerFont(
  fonts,
  name,
  path,
  type = RecipeFontStyle.REGULAR,
) {
  if (typeof name !== "string" || !name) {
    throw new TypeError("Font names must be non-empty strings");
  }
  var family = fonts.get(name.toLowerCase()) || {};
  var style = fontStyleKey(type);
  var previous = family[style];
  family[style] = path;
  fonts.set(name.toLowerCase(), family);
  return previous;
}

/** Resolves the best registered font path for the requested style. */
export function getFont(fonts, options = {}) {
  var family = fonts.get(String(options.font || "").toLowerCase());
  if (!family) throw new Error(`Unknown font: ${options.font || "(none)"}`);
  return (
    family[fontStyle(options)] || family.r || family.b || family.i || family.bi
  );
}
