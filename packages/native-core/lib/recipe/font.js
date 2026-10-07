const fs = require("fs");
const path = require("path");
const { FontStyle } = require("../recipe-constants");

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
 * @param {string} [fontSrcPath=''] - The path to the font file.
 * @param {Recipe.FontStyle} [type='regular'] - The style this file provides,
 *   one of the `Recipe.FontStyle` values or its short form r, b, i or bi.
 *   Any other value registers the regular style.
 * @param {boolean} [isDefault=false] - Make this family the Recipe's default
 *   font family, as the `defaultFontFamily` option does. The latest default
 *   set, by the option or by a registration, applies.
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If `isDefault` is not a boolean, or is true and the
 *   font name is empty.
 * @throws {Error} If `isDefault` is true and the font file does not exist,
 *   so a broken default fails here instead of when text is drawn.
 */
exports.registerFont = function registerFont(
  fontName = "",
  fontSrcPath = "",
  type = FontStyle.REGULAR,
  isDefault = false,
) {
  if (typeof isDefault !== "boolean") {
    throw new TypeError(
      `registerFont isDefault must be a boolean, received ${isDefault}`,
    );
  }
  if (isDefault && (typeof fontName !== "string" || !fontName)) {
    throw new TypeError("Font names must be non-empty strings");
  }
  if (isDefault && !fs.existsSync(fontSrcPath)) {
    throw new Error(`Cannot find font file: ${fontSrcPath}`);
  }
  this._registerFont(fontName, fontSrcPath, type);
  if (isDefault) this.current.defaultFontFamily = fontName.toLowerCase();
  return this;
};

/**
 * Register every .ttf, .ttc and .otf file in the given directories, deriving
 * the family and style from the file name (for example "Roboto-BoldItalic").
 * Missing directories are skipped.
 * @private
 * @param {string|string[]} fontSrcPath - The font directory or directories.
 * @returns {void}
 * @throws {Error} If an existing directory cannot be read.
 */
exports._loadFonts = function _loadFonts(fontSrcPath) {
  const fontTypes = [".ttf", ".ttc", ".otf"];
  const fontPaths =
    typeof fontSrcPath === "string" ? [fontSrcPath] : fontSrcPath;

  for (let fpath of fontPaths) {
    if (fs.existsSync(fpath)) {
      // only process when directory exists
      fs.readdirSync(fpath)
        .filter((file) => {
          return fontTypes.includes(path.extname(file).toLowerCase());
        })
        .forEach((file) => {
          let fontName = path.basename(file, path.extname(file)).toLowerCase();
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
          return this._registerFont(fontName, path.join(fpath, file), type);
        });
    }
  }
};

/**
 * Record a font file for a family and style.
 * @private
 * @param {string} fontName - The family name, stored lower-cased.
 * @param {string} fontSrcPath - The font file path.
 * @param {Recipe.FontStyle|string} [type='regular'] - A `Recipe.FontStyle`
 *   value or its short form; anything else is stored as regular.
 * @returns {Recipe} The recipe instance.
 */
exports._registerFont = function _registerFont(
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
 * Pick the registered font file for the family and bold/italic options. A
 * family that is unknown or lacks the style, or whose file is inaccessible,
 * falls back to the Recipe's default family in that style, then to its
 * regular face.
 * @private
 * @param {Recipe} self - The recipe instance.
 * @param {Object} [options] - Text options: font, and bold/isBold, italic/isItalic.
 * @returns {string} The font file path.
 * @throws {Error} If the default family is not registered.
 */
function _getFontFile(self, options = {}) {
  let fontFile;
  const defaultFamily = self.current.defaultFontFamily;
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

  if (options.font) {
    const fontFamily = self.fonts[options.font.toLowerCase()];
    if (fontFamily) {
      fontFile = fontFamily[type];
    }
  }

  // when file inaccessible ...
  if (!fontFile || !fs.existsSync(fontFile)) {
    const fallback = self.fonts[defaultFamily];
    if (!fallback) {
      throw new Error(`Unknown font: ${defaultFamily}`);
    }
    // use the default family when otherwise unavailable.
    fontFile =
      fallback[type] ||
      fallback[FontSlot.REGULAR] ||
      fallback[FontSlot.BOLD] ||
      fallback[FontSlot.ITALIC] ||
      fallback[FontSlot.BOLD_ITALIC];
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
exports._getFont = function _getFont(options) {
  this.current = this.current || {};

  const fontFile = _getFontFile(this, options);

  if (!this.current[fontFile]) {
    this.current[fontFile] = this.writer.getFontForFile(fontFile);
  }

  return this.current[fontFile];
};
