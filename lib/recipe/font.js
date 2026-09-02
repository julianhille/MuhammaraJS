const fs = require("fs");
const path = require("path");
/**
 * Register a custom font
 * @name registerFont
 * @function
 * @memberof Recipe
 * @param {string} fontName - The font name will be used in text
 * @param {string} fontSrcPath - The path to the font file.
 * @param {string} [type='regular'] - The font type, one of 'bold', 'bold-italic', 'italic'
 */
exports.registerFont = function registerFont(
  fontName = "",
  fontSrcPath = "",
  type = "regular",
) {
  return this._registerFont(fontName, fontSrcPath, type);
};

exports._loadFonts = function _loadFonts(fontSrcPath) {
  const fontTypes = [".ttf", ".ttc", ".otf"];
  const fontPaths =
    typeof fontSrcPath === "string" ? [fontSrcPath] : fontSrcPath;

  const registerFontFile = (file) => {
    let fontName = path.basename(file, path.extname(file)).toLowerCase();
    // simple heuristics to make sure library fonts behave as expected
    const hasBold = fontName.indexOf("bold") !== -1;
    const hasItalic = fontName.indexOf("italic") !== -1;
    let type = "r";
    if (hasBold && hasItalic) {
      fontName = fontName.replace(/-*bold/, "");
      fontName = fontName.replace(/-*italic/, "");
      type = "bi";
    } else if (hasBold) {
      fontName = fontName.replace(/-*bold/, "");
      type = "b";
    } else if (hasItalic) {
      fontName = fontName.replace(/-*italic/, "");
      type = "i";
    }
    return this._registerFont(fontName, file, type);
  };

  for (let fpath of fontPaths) {
    if (!fs.existsSync(fpath)) throw `Cannot load font file '${fpath}'`;
    if (fs.statSync(fpath).isFile()) {
      if (!fontTypes.includes(path.extname(fpath).toLowerCase())) {
        throw `Invalid font file '${fpath}', allowed extensions ${fontTypes}`;
      }
      registerFontFile(fpath);
    } else {
      fs.readdirSync(fpath)
        .filter((file) => fontTypes.includes(path.extname(file).toLowerCase()))
        .map((file) => path.join(fpath, file))
        .forEach(registerFontFile);
    }
  }
};

exports._registerFont = function _registerFont(
  fontName,
  fontSrcPath,
  type = "regular",
) {
  this.fonts = this.fonts || {};
  let family = fontName.toLowerCase();
  let font = this.fonts[family] || {};

  if (!fs.existsSync(fontSrcPath)) {
    throw `Cannot load font file '${fontSrcPath}'`;
  }

  switch (type) {
    default:
      font.r = fontSrcPath;
      break;
    case "bold":
    case "b":
      font.b = fontSrcPath;
      break;
    case "italic":
    case "i":
      font.i = fontSrcPath;
      break;
    case "bold-italic":
    case "bi":
      font.bi = fontSrcPath;
      break;
  }
  this.fonts[family] = font;

  return this;
};

function _getFontFile(self, options = {}) {
  const font = options.font?.toLowerCase() ?? self.current.defaultFontFamily;

  // Need to choose appropriate file based on bold/italic considerations
  // Note, if this is not done explicitly, the font dimensions will be incorrect.
  let type =
    (options.bold || options.isBold) && (options.italic || options.isItalic)
      ? "bi"
      : options.italic || options.isItalic
        ? "i"
        : options.bold || options.isBold
          ? "b"
          : "r";

  const fontFile =
    self.fonts[font]?.[type] ??
    self.fonts[self.current.defaultFontFamily][type] ??
    self.fonts[self.current.defaultFontFamily]["r"];

  if (!fontFile) {
    throw `Unknown font-type pair '${font ?? self.current.defaultFontFamily}', '${type}'`;
  }
  return fontFile;
}

exports._getFont = function _getFont(options) {
  this.current = this.current || {};

  const fontFile = _getFontFile(this, options);

  if (!this.current[fontFile]) {
    this.current[fontFile] = this.writer.getFontForFile(fontFile);
  }

  return this.current[fontFile];
};
