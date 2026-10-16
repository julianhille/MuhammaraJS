import { FontStyle } from "../recipe-constants.js";

// Keys of the per-style font files stored for each family in this.fonts.
const FontSlot = Object.freeze({
  REGULAR: "r",
  BOLD: "b",
  ITALIC: "i",
  BOLD_ITALIC: "bi",
});

/**
 * Register a custom font
 * @name registerFont
 * @function
 * @memberof Recipe#
 * @param {string} [fontName=''] - The font name used in text, matched case-insensitively.
 * @param {string|Uint8Array} [fontSrcPath=''] - The font: a file path on
 *   native, bytes or a registered font name on Wasm.
 * @param {Recipe.FontStyle} [type='regular'] - The style this file provides,
 *   one of the `Recipe.FontStyle` values or its short form r, b, i or bi.
 *   Any other value registers the regular style.
 * @returns {Recipe} The recipe instance.
 */
export const registerFont = function registerFont(
  fontName = "",
  fontSrcPath = "",
  type = FontStyle.REGULAR,
) {
  return this._registerFont(
    fontName,
    this.platform.fontSource(fontName, fontSrcPath, type),
    type,
  );
};

/**
 * Register every .ttf, .ttc and .otf font the platform finds in the given
 * places, deriving the family and style from the file name (for example
 * "Roboto-BoldItalic"). Places the platform cannot read are skipped.
 * @private
 * @param {string|string[]} fontSrcPath - The font directory or directories.
 * @returns {void}
 * @throws {Error} If an existing directory cannot be read.
 */
export const _loadFonts = function _loadFonts(fontSrcPath) {
  const fontPaths =
    typeof fontSrcPath === "string" ? [fontSrcPath] : fontSrcPath;

  for (const { name, ref } of this.platform.fontFiles(fontPaths)) {
    let fontName = name.toLowerCase();
    // simple heuristics to make sure library fonts behave as expected
    const hasBold = fontName.indexOf(FontStyle.BOLD) !== -1;
    const hasItalic = fontName.indexOf(FontStyle.ITALIC) !== -1;
    let type = FontSlot.REGULAR;
    if (hasBold && hasItalic) {
      fontName = fontName.replace(/-*bold/, "");
      fontName = fontName.replace(/-*italic/, "");
      type = FontSlot.BOLD_ITALIC;
    } else if (hasBold) {
      fontName = fontName.replace(/-*bold/, "");
      type = FontSlot.BOLD;
    } else if (hasItalic) {
      fontName = fontName.replace(/-*italic/, "");
      type = FontSlot.ITALIC;
    }
    this._registerFont(fontName, ref, type);
  }
};

/**
 * Record a font file for a family and style.
 * @private
 * @param {string} fontName - The family name, stored lower-cased.
 * @param {*} fontSrcPath - The platform's font reference.
 * @param {Recipe.FontStyle|string} [type='regular'] - A `Recipe.FontStyle`
 *   value or its short form; anything else is stored as regular.
 * @returns {Recipe} The recipe instance.
 */
export const _registerFont = function _registerFont(
  fontName,
  fontSrcPath,
  type = FontStyle.REGULAR,
) {
  this.fonts = this.fonts || {};
  let family = fontName.toLowerCase();
  let font = this.fonts[family] || {};

  switch (type) {
    default:
      font[FontSlot.REGULAR] = fontSrcPath;
      break;
    case FontStyle.BOLD:
    case FontSlot.BOLD:
      font[FontSlot.BOLD] = fontSrcPath;
      break;
    case FontStyle.ITALIC:
    case FontSlot.ITALIC:
      font[FontSlot.ITALIC] = fontSrcPath;
      break;
    case FontStyle.BOLD_ITALIC:
    case FontSlot.BOLD_ITALIC:
      font[FontSlot.BOLD_ITALIC] = fontSrcPath;
      break;
  }
  this.fonts[family] = font;

  return this;
};

/**
 * Pick the registered font file for the family and bold/italic options:
 * the family's regular face when the style is unavailable.
 * @private
 * @param {Recipe} self - The recipe instance.
 * @param {Object} [options] - Text options: font, and bold/isBold, italic/isItalic.
 * @returns {*} The platform's font reference.
 * @throws {Error} If the family is not registered, or there is no default one.
 */
function _getFontFile(self, options = {}) {
  let fontFile;
  // Need to choose appropriate file based on bold/italic considerations
  // Note, if this is not done explicitly, the font dimensions will be incorrect.
  let type =
    (options.bold || options.isBold) && (options.italic || options.isItalic)
      ? FontSlot.BOLD_ITALIC
      : options.italic || options.isItalic
        ? FontSlot.ITALIC
        : options.bold || options.isBold
          ? FontSlot.BOLD
          : FontSlot.REGULAR;

  // The named family, or the platform's default one. An unknown name throws
  // rather than drawing in another font, and a missing style uses the
  // family's regular face, so the text keeps its typeface.
  const name = options.font ?? self.platform.defaultFontFamily;
  const family =
    name === undefined ? undefined : self.fonts[String(name).toLowerCase()];
  const usable = (file) => file && self.platform.fontExists(file);
  if (family)
    fontFile = usable(family[type]) ? family[type] : family[FontSlot.REGULAR];
  if (!usable(fontFile)) {
    throw new Error(`Unknown font: ${options.font ?? "(none)"}`);
  }

  return fontFile;
}

/**
 * Load the writer font for text options once per font file.
 * @private
 * @param {Object} [options] - Text options: font, and bold/isBold, italic/isItalic.
 * @returns {Object} The writer's used font.
 * @throws {Error} If the font file cannot be loaded.
 */
export const _getFont = function _getFont(options) {
  this.current = this.current || {};

  const fontFile = _getFontFile(this, options);

  if (!this.current[fontFile]) {
    this.current[fontFile] = this.platform.getFont(this.writer, fontFile);
  }

  return this.current[fontFile];
};
