import { FontStyle, FontStyleKey } from "../value-sets.js";
/**
 * Picks the registry key for bold and italic text options.
 * @param {object} [options={}] - `bold`/`isBold` and `italic`/`isItalic`.
 * @returns {RecipeFontStyle} `r`, `b`, `i`, or `bi`.
 */
function fontStyle(options = {}) {
  return (options.bold || options.isBold) &&
    (options.italic || options.isItalic)
    ? FontStyleKey.BI
    : options.italic || options.isItalic
      ? FontStyleKey.I
      : options.bold || options.isBold
        ? FontStyleKey.B
        : FontStyleKey.R;
}

/** Registry key for every RecipeFontStyle spelling. */
var FONT_STYLE_KEYS = {
  [FontStyle.REGULAR]: FontStyleKey.R,
  [FontStyleKey.R]: FontStyleKey.R,
  [FontStyle.BOLD]: FontStyleKey.B,
  [FontStyleKey.B]: FontStyleKey.B,
  [FontStyle.ITALIC]: FontStyleKey.I,
  [FontStyleKey.I]: FontStyleKey.I,
  [FontStyle.BOLD_ITALIC]: FontStyleKey.BI,
  [FontStyleKey.BI]: FontStyleKey.BI,
};

/**
 * Resolves a font style spelling, in any letter case, to its registry key.
 * @param {*} type - A RecipeFontStyle value.
 * @returns {string} `r`, `b`, `i`, or `bi`; unknown styles resolve to `r`.
 */
export function fontStyleKey(type) {
  return FONT_STYLE_KEYS[String(type).toLowerCase()] || FontStyleKey.R;
}

/**
 * Registers a font path for a family and style.
 *
 * @param {Map<string, object>} fonts - Font families keyed by lower-case name.
 * @param {string} name - Non-empty family name.
 * @param {string} path - Virtual file system path of the font.
 * @param {RecipeFontStyle} [type="regular"] - Style to register.
 * @returns {string|undefined} The previously registered path. The caller owns
 * cleanup of that replaced path.
 * @throws {TypeError} If `name` is empty or not a string.
 */
export function registerFont(fonts, name, path, type = FontStyle.REGULAR) {
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

/**
 * Resolves the best registered font path for the requested style.
 * @param {Map<string, object>} fonts - Font families keyed by lower-case name.
 * @param {object} [options={}] - `font`, `bold`, and `italic`.
 * @returns {string} Virtual path of the matching style, or of any registered style.
 * @throws {Error} If the family is not registered.
 */
export function getFont(fonts, options = {}) {
  var family = fonts.get(String(options.font || "").toLowerCase());
  if (!family) throw new Error(`Unknown font: ${options.font || "(none)"}`);
  return (
    family[fontStyle(options)] || family.r || family.b || family.i || family.bi
  );
}
