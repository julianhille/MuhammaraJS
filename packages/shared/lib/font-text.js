// Decodes text-showing operand bytes through a page font and encodes text back
// into the same font. Mirrored in packages/native-core/lib/font-text.js; keep
// both files identical apart from the module syntax.

import * as contentStream from "./content-stream.js";
import { glyphs } from "./glyph-list.js";

// PDF dictionary keys this module reads.
var PdfName = Object.freeze({
  BASE_ENCODING: "BaseEncoding",
  BASE_FONT: "BaseFont",
  DIFFERENCES: "Differences",
  ENCODING: "Encoding",
  FIRST_CHAR: "FirstChar",
  FONT: "Font",
  FONT_DESCRIPTOR: "FontDescriptor",
  FONT_FILE: "FontFile",
  FONT_FILE3: "FontFile3",
  LAST_CHAR: "LastChar",
  SUBTYPE: "Subtype",
  TO_UNICODE: "ToUnicode",
  WIDTHS: "Widths",
});

// Standard 14 fonts with their own built-in, non-Latin encodings. Their codes
// decode only through a `/ToUnicode` CMap or `/Differences`.
var SymbolicStandardFont = Object.freeze({
  SYMBOL: "Symbol",
  ZAPF_DINGBATS: "ZapfDingbats",
});

// Limits on the font data one decoding call reads, so untrusted fonts cannot
// make decoding inflate or parse unbounded data. A larger ToUnicode CMap is
// ignored, and the font decodes through its encoding instead.
var MAX_TO_UNICODE_BYTES = 4 * 1024 * 1024;
var MAX_CALL_TO_UNICODE_BYTES = 32 * 1024 * 1024;
// Most `bfrange` codes one call may expand across all its CMaps. A CMap that
// would pass it is ignored as a whole.
var MAX_CALL_RANGE_ENTRIES = 0x200000;
// Most fonts, and most decode-map entries across them, a reader keeps cached;
// the least recently used are dropped first.
var MAX_CACHED_FONTS = 256;
var MAX_CACHED_ENTRIES = 0x200000;
var MAX_DIFFERENCES_ITEMS = 512;

// Most PDF objects one decoding call reads when the caller sets no tighter
// `maxParsedObjects` limit; matches the extractor's ceiling.
var MAX_PARSED_OBJECTS = 1000000;

// Font subtypes that change how codes are read.
var FontSubtype = Object.freeze({
  TYPE0: "Type0",
  TYPE1: "Type1",
  TYPE3: "Type3",
  MM_TYPE1: "MMType1",
  TRUE_TYPE: "TrueType",
});

// Font encoding names this module interprets.
var FontEncoding = Object.freeze({
  WIN_ANSI: "WinAnsiEncoding",
  MAC_ROMAN: "MacRomanEncoding",
  STANDARD: "StandardEncoding",
  IDENTITY_H: "Identity-H",
  IDENTITY_V: "Identity-V",
});

// ToUnicode CMap sections this module reads.
var CMapSection = Object.freeze({
  CODESPACE_RANGE: "codespacerange",
  BF_CHAR: "bfchar",
  BF_RANGE: "bfrange",
});

// Keywords that open and close each CMap section.
var CMapKeyword = Object.freeze({
  BEGIN_CODESPACE_RANGE: "begincodespacerange",
  END_CODESPACE_RANGE: "endcodespacerange",
  BEGIN_BF_CHAR: "beginbfchar",
  END_BF_CHAR: "endbfchar",
  BEGIN_BF_RANGE: "beginbfrange",
  END_BF_RANGE: "endbfrange",
});

var SECTION_BY_BEGIN_KEYWORD = new Map([
  [CMapKeyword.BEGIN_CODESPACE_RANGE, CMapSection.CODESPACE_RANGE],
  [CMapKeyword.BEGIN_BF_CHAR, CMapSection.BF_CHAR],
  [CMapKeyword.BEGIN_BF_RANGE, CMapSection.BF_RANGE],
]);

var END_KEYWORDS = new Set([
  CMapKeyword.END_CODESPACE_RANGE,
  CMapKeyword.END_BF_CHAR,
  CMapKeyword.END_BF_RANGE,
]);

// ToUnicode CMap token kinds.
var CMapToken = Object.freeze({
  HEX: "hex",
  NAME: "name",
  KEYWORD: "keyword",
  ARRAY_START: "[",
  ARRAY_END: "]",
});

var ASCII_NAMES = (
  "space exclam quotedbl numbersign dollar percent ampersand quotesingle " +
  "parenleft parenright asterisk plus comma hyphen period slash zero one two " +
  "three four five six seven eight nine colon semicolon less equal greater " +
  "question at A B C D E F G H I J K L M N O P Q R S T U V W X Y Z " +
  "bracketleft backslash bracketright asciicircum underscore grave a b c d e " +
  "f g h i j k l m n o p q r s t u v w x y z braceleft bar braceright " +
  "asciitilde"
).split(" ");

var LATIN1_NAMES = (
  "nbspace exclamdown cent sterling currency yen brokenbar section dieresis " +
  "copyright ordfeminine guillemotleft logicalnot sfthyphen registered macron " +
  "degree plusminus twosuperior threesuperior acute mu paragraph " +
  "periodcentered cedilla onesuperior ordmasculine guillemotright onequarter " +
  "onehalf threequarters questiondown Agrave Aacute Acircumflex Atilde " +
  "Adieresis Aring AE Ccedilla Egrave Eacute Ecircumflex Edieresis Igrave " +
  "Iacute Icircumflex Idieresis Eth Ntilde Ograve Oacute Ocircumflex Otilde " +
  "Odieresis multiply Oslash Ugrave Uacute Ucircumflex Udieresis Yacute Thorn " +
  "germandbls agrave aacute acircumflex atilde adieresis aring ae ccedilla " +
  "egrave eacute ecircumflex edieresis igrave iacute icircumflex idieresis " +
  "eth ntilde ograve oacute ocircumflex otilde odieresis divide oslash ugrave " +
  "uacute ucircumflex udieresis yacute thorn ydieresis"
).split(" ");

/**
 * Build a 256-entry glyph-name table from ASCII plus high-byte overrides.
 *
 * @param {Object<number, string>} overrides Code-to-name overrides.
 * @param {string[]} [high] Names for codes 0x80 to 0xFF, `.` for unused.
 * @returns {Array<string|undefined>} Glyph names indexed by code.
 */
function encodingTable(overrides, high) {
  var table = new Array(256);
  var index;
  for (index = 0; index < ASCII_NAMES.length; index++) {
    table[0x20 + index] = ASCII_NAMES[index];
  }
  for (index = 0; high && index < high.length; index++) {
    table[0x80 + index] = high[index] === "." ? undefined : high[index];
  }
  return Object.assign(table, overrides);
}

var WIN_ANSI = encodingTable(
  {},
  (
    "Euro . quotesinglbase florin quotedblbase ellipsis dagger daggerdbl " +
    "circumflex perthousand Scaron guilsinglleft OE . Zcaron . . quoteleft " +
    "quoteright quotedblleft quotedblright bullet endash emdash tilde " +
    "trademark scaron guilsinglright oe . zcaron Ydieresis space"
  )
    .split(" ")
    .concat(LATIN1_NAMES.slice(1)),
);
WIN_ANSI[0xad] = "hyphen";

var MAC_ROMAN = encodingTable(
  {},
  (
    "Adieresis Aring Ccedilla Eacute Ntilde Odieresis Udieresis aacute " +
    "agrave acircumflex adieresis atilde aring ccedilla eacute egrave " +
    "ecircumflex edieresis iacute igrave icircumflex idieresis ntilde oacute " +
    "ograve ocircumflex odieresis otilde uacute ugrave ucircumflex udieresis " +
    "dagger degree cent sterling section bullet paragraph germandbls " +
    "registered copyright trademark acute dieresis notequal AE Oslash " +
    "infinity plusminus lessequal greaterequal yen mu partialdiff summation " +
    "product pi integral ordfeminine ordmasculine Omega ae oslash " +
    "questiondown exclamdown logicalnot radical florin approxequal Delta " +
    "guillemotleft guillemotright ellipsis space Agrave Atilde Otilde OE oe " +
    "endash emdash quotedblleft quotedblright quoteleft quoteright divide " +
    "lozenge ydieresis Ydieresis fraction currency guilsinglleft " +
    "guilsinglright fi fl daggerdbl periodcentered quotesinglbase " +
    "quotedblbase perthousand Acircumflex Ecircumflex Aacute Edieresis " +
    "Egrave Iacute Icircumflex Idieresis Igrave Oacute Ocircumflex apple " +
    "Ograve Uacute Ucircumflex Ugrave dotlessi circumflex tilde macron breve " +
    "dotaccent ring cedilla hungarumlaut ogonek caron"
  ).split(" "),
);

var STANDARD = encodingTable({
  0x27: "quoteright",
  0x60: "quoteleft",
  0xa1: "exclamdown",
  0xa2: "cent",
  0xa3: "sterling",
  0xa4: "fraction",
  0xa5: "yen",
  0xa6: "florin",
  0xa7: "section",
  0xa8: "currency",
  0xa9: "quotesingle",
  0xaa: "quotedblleft",
  0xab: "guillemotleft",
  0xac: "guilsinglleft",
  0xad: "guilsinglright",
  0xae: "fi",
  0xaf: "fl",
  0xb1: "endash",
  0xb2: "dagger",
  0xb3: "daggerdbl",
  0xb4: "periodcentered",
  0xb6: "paragraph",
  0xb7: "bullet",
  0xb8: "quotesinglbase",
  0xb9: "quotedblbase",
  0xba: "quotedblright",
  0xbb: "guillemotright",
  0xbc: "ellipsis",
  0xbd: "perthousand",
  0xbf: "questiondown",
  0xc1: "grave",
  0xc2: "acute",
  0xc3: "circumflex",
  0xc4: "tilde",
  0xc5: "macron",
  0xc6: "breve",
  0xc7: "dotaccent",
  0xc8: "dieresis",
  0xca: "ring",
  0xcb: "cedilla",
  0xcd: "hungarumlaut",
  0xce: "ogonek",
  0xcf: "caron",
  0xd0: "emdash",
  0xe1: "AE",
  0xe3: "ordfeminine",
  0xe8: "Lslash",
  0xe9: "Oslash",
  0xea: "OE",
  0xeb: "ordmasculine",
  0xf1: "ae",
  0xf5: "dotlessi",
  0xf8: "lslash",
  0xf9: "oslash",
  0xfa: "oe",
  0xfb: "germandbls",
});

var BASE_ENCODINGS = new Map([
  [FontEncoding.WIN_ANSI, WIN_ANSI],
  [FontEncoding.MAC_ROMAN, MAC_ROMAN],
  [FontEncoding.STANDARD, STANDARD],
]);

/**
 * Map a glyph name to Unicode text, following the Adobe Glyph List naming
 * rules for `uniXXXX`, `uXXXX`, suffixes, and ligature components.
 *
 * @param {string} name Glyph name.
 * @returns {string|undefined} Unicode text, or undefined when unknown.
 */
function glyphNameToUnicode(name) {
  var base = name.split(".")[0];
  if (base.indexOf("_") !== -1) {
    var parts = base.split("_").map(glyphNameToUnicode);
    return parts.every(Boolean) ? parts.join("") : undefined;
  }
  var known = glyphs();
  if (base in known) return known[base];
  var match = /^uni((?:[0-9A-F]{4})+)$/.exec(base);
  if (match) {
    var text = "";
    for (var offset = 0; offset < match[1].length; offset += 4) {
      var unit = parseInt(match[1].slice(offset, offset + 4), 16);
      // The glyph list rules exclude surrogates.
      if (isSurrogate(unit)) return undefined;
      text += String.fromCharCode(unit);
    }
    return text;
  }
  match = /^u([0-9A-F]{4,6})$/.exec(base);
  if (match) {
    var codePoint = parseInt(match[1], 16);
    if (codePoint <= 0x10ffff && !isSurrogate(codePoint)) {
      return String.fromCodePoint(codePoint);
    }
  }
  return undefined;
}

/**
 * Check whether a code point is a UTF-16 surrogate.
 *
 * @param {number} codePoint Code point.
 * @returns {boolean} True for U+D800 to U+DFFF.
 */
function isSurrogate(codePoint) {
  return codePoint >= 0xd800 && codePoint <= 0xdfff;
}

/**
 * Decode big-endian UTF-16 bytes.
 *
 * @param {string} bytes One-byte string.
 * @returns {string} Decoded text.
 */
function utf16be(bytes) {
  var text = "";
  for (var index = 0; index + 1 < bytes.length; index += 2) {
    text += String.fromCharCode(
      (bytes.charCodeAt(index) << 8) | bytes.charCodeAt(index + 1),
    );
  }
  return text;
}

/**
 * Split a CMap into tokens: hex strings, names, brackets, and keywords.
 *
 * @param {string} source One-byte CMap stream.
 * @returns {Array<{type: string, value: string}>} Tokens.
 */
function cmapTokens(source) {
  var tokens = [];
  // Every branch matches in one pass: an unclosed literal string runs to the
  // end instead of being rescanned from each "(", which would be quadratic.
  var pattern =
    /%[^\r\n]*|<([0-9A-Fa-f\s]*)>|\/([^\s()<>[\]{}/%]*)|([[\]])|\((?:\\[\s\S]|[^\\)])*\)?|([^\s()<>[\]{}/%]+)/g;
  var match;
  while ((match = pattern.exec(source))) {
    if (match[1] !== undefined) {
      tokens.push({
        type: CMapToken.HEX,
        value: contentStream.hexBytes(match[1]),
      });
    } else if (match[2] !== undefined) {
      tokens.push({ type: CMapToken.NAME, value: match[2] });
    } else if (match[3] !== undefined) {
      tokens.push({ type: match[3], value: match[3] });
    } else if (match[4] !== undefined) {
      tokens.push({ type: CMapToken.KEYWORD, value: match[4] });
    }
  }
  return tokens;
}

/**
 * Add one to the last UTF-16 code unit of a destination string.
 *
 * @param {string} value Destination text.
 * @param {number} offset Amount to add.
 * @returns {string} Offset text.
 */
function offsetDestination(value, offset) {
  return (
    value.slice(0, -1) +
    String.fromCharCode(value.charCodeAt(value.length - 1) + offset)
  );
}

/**
 * Format a code as a one-byte string of the given length.
 *
 * @param {number} code Numeric code.
 * @param {number} length Byte length.
 * @returns {string} One-byte string.
 */
function codeBytes(code, length) {
  var bytes = "";
  for (var index = length - 1; index >= 0; index--) {
    bytes += String.fromCharCode((code >>> (index * 8)) & 0xff);
  }
  return bytes;
}

/**
 * Read a code from a one-byte string.
 *
 * @param {string} bytes One-byte string.
 * @returns {number} Numeric code.
 */
function codeValue(bytes) {
  var code = 0;
  for (var index = 0; index < bytes.length; index++) {
    code = code * 256 + bytes.charCodeAt(index);
  }
  return code;
}

// Upper bound on the codes all `bfrange` entries of one CMap may expand to,
// so a hostile CMap cannot stall decoding. Two-byte codes need at most 0x10000.
var MAX_RANGE_ENTRIES = 0x20000;

/**
 * Parse a ToUnicode CMap.
 *
 * @param {string} source One-byte CMap stream.
 * @returns {{codespace: Array<{low: string, high: string}>, map: Map<string,
 * string>, rangeEntries: number}} Codespace ranges, code-to-text mappings
 * keyed by code bytes, and how many codes its `bfrange` entries expanded to.
 */
function parseToUnicode(source) {
  var tokens = cmapTokens(source);
  var codespace = [];
  var map = new Map();
  var mode = null;
  var operands = [];
  var rangeBudget = MAX_RANGE_ENTRIES;

  /**
   * Apply one CMap token to the section being read.
   *
   * @param {{type: string, value: string}} token CMap token.
   * @returns {void}
   */
  function readToken(token) {
    if (token.type === CMapToken.KEYWORD) {
      if (SECTION_BY_BEGIN_KEYWORD.has(token.value)) {
        mode = SECTION_BY_BEGIN_KEYWORD.get(token.value);
        operands = [];
      } else if (END_KEYWORDS.has(token.value)) {
        mode = null;
      }
      return;
    }
    if (!mode) return;
    if (mode === CMapSection.BF_RANGE && token.type === CMapToken.ARRAY_START) {
      operands.push([]);
      return;
    }
    if (mode === CMapSection.BF_RANGE && token.type === CMapToken.ARRAY_END) {
      flushRange();
      return;
    }
    var last = operands[operands.length - 1];
    if (
      mode === CMapSection.BF_RANGE &&
      Array.isArray(last) &&
      operands.length === 3
    ) {
      last.push(token);
      return;
    }
    operands.push(token);

    if (mode === CMapSection.CODESPACE_RANGE && operands.length === 2) {
      if (operands[0].value.length === operands[1].value.length) {
        codespace.push({ low: operands[0].value, high: operands[1].value });
      }
      operands = [];
    } else if (mode === CMapSection.BF_CHAR && operands.length === 2) {
      var text = destinationText(operands[1]);
      if (text !== undefined) map.set(operands[0].value, text);
      operands = [];
    } else if (
      mode === CMapSection.BF_RANGE &&
      operands.length === 3 &&
      !Array.isArray(operands[2])
    ) {
      flushRange();
    }
  }

  tokens.forEach(readToken);

  /** Apply the collected `bfrange` operands. */
  function flushRange() {
    var low = operands[0];
    var high = operands[1];
    var destination = operands[2];
    operands = [];
    if (
      !low ||
      !high ||
      !destination ||
      low.type !== CMapToken.HEX ||
      high.type !== CMapToken.HEX
    ) {
      return;
    }
    var length = low.value.length;
    var start = codeValue(low.value);
    var end = Math.min(codeValue(high.value), start + rangeBudget - 1);
    rangeBudget -= Math.max(0, end - start + 1);
    var first = Array.isArray(destination)
      ? undefined
      : destinationText(destination);
    for (var code = start; code <= end; code++) {
      var text;
      if (Array.isArray(destination)) {
        var item = destination[code - start];
        text = item && destinationText(item);
      } else if (destination.type === CMapToken.HEX) {
        text =
          first === undefined
            ? undefined
            : offsetDestination(first, code - start);
      } else {
        text = code === start ? destinationText(destination) : undefined;
      }
      if (text !== undefined) map.set(codeBytes(code, length), text);
    }
  }

  return {
    codespace: codespace,
    map: map,
    rangeEntries: MAX_RANGE_ENTRIES - rangeBudget,
  };
}

/**
 * Convert a `bfchar` or `bfrange` destination token to text.
 *
 * @param {{type: string, value: string}} token Destination token.
 * @returns {string|undefined} Text, or undefined when not decodable.
 */
function destinationText(token) {
  if (token.type === CMapToken.NAME) return glyphNameToUnicode(token.value);
  if (token.type !== CMapToken.HEX || !token.value.length) return undefined;
  // Destinations are UTF-16BE; some producers write one byte, such as <41>.
  var bytes = token.value.length % 2 ? "\x00" + token.value : token.value;
  return utf16be(bytes);
}

/**
 * Split operand bytes into character codes.
 *
 * @param {string} bytes One-byte operand string.
 * @param {Array<{low: string, high: string}>} codespace Codespace ranges.
 * @param {number} fallbackLength Code length without a matching range.
 * @returns {string[]} Codes as one-byte strings.
 */
function splitCodes(bytes, codespace, fallbackLength) {
  var codes = [];
  var index = 0;
  while (index < bytes.length) {
    var length = 0;
    for (var size = 1; size <= 4 && !length; size++) {
      var candidate = bytes.substr(index, size);
      if (candidate.length !== size) break;
      for (var range = 0; range < codespace.length; range++) {
        if (inCodespace(candidate, codespace[range])) {
          length = size;
          break;
        }
      }
    }
    length = length || fallbackLength;
    codes.push(bytes.substr(index, length));
    index += length;
  }
  return codes;
}

/**
 * Check whether a code lies in a codespace range, byte by byte.
 *
 * @param {string} code Code bytes.
 * @param {{low: string, high: string}} range Codespace range.
 * @returns {boolean} True when every byte lies between the range bounds.
 */
function inCodespace(code, range) {
  if (code.length !== range.low.length) return false;
  for (var index = 0; index < code.length; index++) {
    var byte = code.charCodeAt(index);
    if (
      byte < range.low.charCodeAt(index) ||
      byte > range.high.charCodeAt(index)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Create a codec that decodes and encodes text for one font.
 *
 * @param {object} description Font description.
 * @param {boolean} description.composite True for Type0 fonts.
 * @param {boolean} description.identity True for Type0 fonts with an
 * `Identity-H` or `Identity-V` encoding.
 * @param {object|null} description.toUnicode Parsed ToUnicode CMap.
 * @param {string|null} description.baseEncoding Simple-font base encoding
 * name, or null when the font's built-in encoding is unknown.
 * @param {Array<number|string>} description.differences Flattened
 * `/Differences` array.
 * @param {function(): {values: number[]|null, firstChar: number, malformed:
 * boolean}} description.readWidths Reads a simple font's `/Widths`; called on
 * the first encode, since only encoding needs them.
 * @returns {{decode: function(string): string, encode: function(string,
 * string): string, size: number}} Font codec; `encode` takes the font resource
 * name for its errors, and `size` is its decode map's entry count.
 */
function createFontCodec(description) {
  var toUnicode = description.toUnicode || {
    codespace: [],
    map: new Map(),
    rangeEntries: 0,
  };
  var codeLength = description.composite ? 2 : 1;
  var codespace = toUnicode.codespace;
  if (!description.composite) {
    codespace = [{ low: "\x00", high: "\xff" }];
  } else if (description.identity) {
    // Identity-H and Identity-V read every code as two bytes, whatever
    // codespace the ToUnicode CMap declares.
    codespace = [{ low: "\x00\x00", high: "\xff\xff" }];
  }
  // A composite font decodes through its CMap alone, so it shares the parsed
  // map. A simple font reads one-byte codes, so it keeps just those.
  var decodeMap = description.composite ? toUnicode.map : new Map();

  if (!description.composite) {
    toUnicode.map.forEach(addOneByteCode);
    var names =
      description.baseEncoding === null
        ? new Array(256)
        : (BASE_ENCODINGS.get(description.baseEncoding) || STANDARD).slice();
    var code = 0;
    for (var index = 0; index < description.differences.length; index++) {
      var entry = description.differences[index];
      if (typeof entry === "number") {
        code = entry;
      } else if (code < 256) {
        names[code++] = entry;
      }
    }
    for (code = 0; code < names.length; code++) {
      var bytes = String.fromCharCode(code);
      var text = names[code] && glyphNameToUnicode(names[code]);
      if (text !== undefined && !decodeMap.has(bytes)) {
        decodeMap.set(bytes, text);
      }
    }
  }

  // Built on the first encode; extraction only decodes.
  var encodeMap = null;
  var longestText = 1;
  var widths = null;

  /**
   * Copy a one-byte ToUnicode mapping into a simple font's decode map.
   *
   * @param {string} text Decoded text.
   * @param {string} bytes Code bytes.
   * @returns {void}
   */
  function addOneByteCode(text, bytes) {
    if (bytes.length === 1) decodeMap.set(bytes, text);
  }

  /**
   * Read the font's widths once, when encoding first needs them.
   *
   * @returns {{values: number[]|null, firstChar: number, malformed: boolean}}
   * Widths.
   */
  function fontWidths() {
    if (!widths) widths = description.readWidths();
    return widths;
  }

  /**
   * Record the first code that shows `text`, so encoding can reverse the
   * decode map. Codes without a glyph in the font are skipped.
   *
   * @param {string} text Decoded text.
   * @param {string} bytes Code bytes.
   * @returns {void}
   */
  function addEncoding(text, bytes) {
    if (!text || encodeMap.has(text) || !hasGlyph(bytes)) return;
    encodeMap.set(text, bytes);
    longestText = Math.max(longestText, text.length);
  }

  /**
   * Check a simple-font code against `/Widths`; subset fonts write zero for
   * glyphs they leave out.
   *
   * @param {string} bytes Code bytes.
   * @returns {boolean} True when the font can show the code.
   */
  function hasGlyph(bytes) {
    if (description.composite) return true;
    var font = fontWidths();
    if (!font.values) return true;
    var width = font.values[bytes.charCodeAt(0) - font.firstChar];
    return typeof width === "number" && width > 0;
  }

  /**
   * Decode operand bytes to Unicode text.
   *
   * @param {string} bytes Operand bytes, one character per byte.
   * @returns {string} Text; codes the font does not map become U+FFFD.
   */
  function decode(bytes) {
    var codes = splitCodes(bytes, codespace, codeLength);
    var text = "";
    for (var index = 0; index < codes.length; index++) {
      var decoded = decodeMap.get(codes[index]);
      text += decoded === undefined ? "�" : decoded;
    }
    return text;
  }

  /**
   * Encode text to operand bytes, preferring the longest mapped text at each
   * position so ligature glyphs are reused.
   *
   * @param {string} text Unicode text.
   * @param {string} fontName Font resource name, for errors.
   * @returns {string} Operand bytes, one character per byte.
   * @throws {Error} If the font's `/Widths` is malformed or the font has no
   * glyph for a character.
   */
  function encode(text, fontName) {
    if (!description.composite && fontWidths().malformed) {
      throw new Error("font " + fontName + " has a malformed /Widths array");
    }
    if (!encodeMap) {
      encodeMap = new Map();
      decodeMap.forEach(addEncoding);
    }
    var bytes = "";
    var missing = [];
    var index = 0;
    while (index < text.length) {
      var matched = false;
      for (
        var size = Math.min(longestText, text.length - index);
        size > 0;
        size--
      ) {
        var code = encodeMap.get(text.substr(index, size));
        if (code !== undefined) {
          bytes += code;
          index += size;
          matched = true;
          break;
        }
      }
      if (!matched) {
        var character = String.fromCodePoint(text.codePointAt(index));
        var quoted = JSON.stringify(character);
        if (missing.indexOf(quoted) === -1) missing.push(quoted);
        index += character.length;
      }
    }
    if (missing.length) {
      throw new Error(
        "font " + fontName + " has no glyph for " + missing.join(", "),
      );
    }
    return bytes;
  }

  return { decode: decode, encode: encode, size: decodeMap.size };
}

/**
 * Decode operand bytes of a font that cannot be resolved or read.
 *
 * @param {string} bytes Operand bytes, one character per byte.
 * @returns {string} One U+FFFD per byte.
 */
function decodeUnreadable(bytes) {
  return "�".repeat(bytes.length);
}

/**
 * Refuse to encode text for a font that cannot be resolved or read.
 *
 * @param {string} text Unicode text.
 * @param {string|null} fontName Font resource name, or null when no font is
 * selected.
 * @returns {never} Never returns.
 * @throws {Error} Always.
 */
function encodeUnreadable(text, fontName) {
  throw new Error(
    fontName === null
      ? "no font is selected"
      : "font " + fontName + " cannot be read",
  );
}

/**
 * Codec for text whose font cannot be resolved or read.
 */
var UNREADABLE_CODEC = Object.freeze({
  decode: decodeUnreadable,
  encode: encodeUnreadable,
  size: 0,
});

/**
 * Read a resolved dictionary entry.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object} dictionary PDF dictionary.
 * @param {string} key Entry name.
 * @returns {object|null} Resolved object, or null when missing.
 */
function entry(reader, dictionary, key) {
  if (!dictionary || !dictionary.exists(key)) return null;
  return reader.queryDictionaryObject(dictionary, key) || null;
}

/**
 * Read a resolved array as a list of PDF objects, skipping items that cannot
 * be resolved.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object} types PDF object type constants.
 * @param {object|null} array PDF array.
 * @param {number} limit Most items to read.
 * @returns {Array<object|undefined>} Resolved items; unresolvable items are
 * undefined.
 */
function arrayItems(reader, types, array, limit) {
  var items = [];
  if (!array || array.getType() !== types.ePDFObjectArray) return items;
  var length = Math.min(array.getLength(), limit);
  for (var index = 0; index < length; index++) {
    items.push(reader.queryArrayObject(array, index));
  }
  return items;
}

/**
 * Check whether a PDF object is a number.
 *
 * @param {object} types PDF object type constants.
 * @param {object|undefined} item PDF object.
 * @returns {boolean} True for integers and reals.
 */
function isNumber(types, item) {
  return Boolean(
    item &&
    (item.getType() === types.ePDFObjectInteger ||
      item.getType() === types.ePDFObjectReal),
  );
}

/**
 * Check whether a simple font's codes follow a built-in encoding that cannot
 * be read here: the Symbol and ZapfDingbats standard fonts, Type 1 fonts whose
 * program is embedded, and Type 3 fonts, which have no base encoding. Their codes decode only through `/ToUnicode` or
 * `/Differences`. Other fonts, including TrueType subsets flagged Symbolic,
 * fall back to a standard encoding.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object} types PDF object type constants.
 * @param {object} font Font dictionary.
 * @param {string|null} subtypeName Font subtype.
 * @returns {boolean} True when the built-in encoding is unknown.
 */
function usesBuiltInEncoding(reader, types, font, subtypeName) {
  var baseFont = entry(reader, font, PdfName.BASE_FONT);
  if (baseFont && baseFont.getType() === types.ePDFObjectName) {
    var name = baseFont.value.replace(/^[A-Z]{6}\+/, "");
    if (Object.values(SymbolicStandardFont).includes(name)) return true;
  }
  // A Type 3 font's codes mean only what its /Differences names.
  if (subtypeName === FontSubtype.TYPE3) return true;
  if (
    subtypeName !== FontSubtype.TYPE1 &&
    subtypeName !== FontSubtype.MM_TYPE1
  ) {
    return false;
  }
  var descriptor = entry(reader, font, PdfName.FONT_DESCRIPTOR);
  return Boolean(
    descriptor &&
    descriptor.getType() === types.ePDFObjectDictionary &&
    (descriptor.exists(PdfName.FONT_FILE) ||
      descriptor.exists(PdfName.FONT_FILE3)),
  );
}

/**
 * Read a `/Differences` array as its codes and glyph names, skipping items
 * that are neither.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object} types PDF object type constants.
 * @param {object|null} array `/Differences` array.
 * @returns {Array<number|string>} Codes and glyph names in order.
 */
function differencesEntries(reader, types, array) {
  var items = arrayItems(reader, types, array, MAX_DIFFERENCES_ITEMS);
  var entries = [];
  for (var index = 0; index < items.length; index++) {
    var item = items[index];
    if (isNumber(types, item)) {
      entries.push(Number(item.value));
    } else if (item && item.getType() === types.ePDFObjectName) {
      entries.push(item.value);
    }
  }
  return entries;
}

/**
 * Read and parse a font's ToUnicode CMap within the call's budgets. A stream
 * shared by several fonts is read and parsed once per call, but each font
 * pays its bytes and expanded ranges, so sharing never changes a result. A
 * CMap that does not fit the remaining budgets is ignored as a whole.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object} types PDF object type constants.
 * @param {object} font Font dictionary.
 * @param {{toUnicodeBytes: number, rangeEntries: number, constrained:
 * boolean, cmaps: Map<number, {parsed: object|null, bytes: number}>}} call
 * Decoding call budgets and its parsed CMaps; `constrained` is set when a
 * budget, not the CMap itself, dropped the CMap.
 * @returns {object|null} Parsed CMap, or null when missing, unreadable, or
 * over the limits.
 * @throws {Error} If reading exceeds the extraction limits.
 */
function readToUnicode(reader, types, font, call) {
  try {
    var stream = entry(reader, font, PdfName.TO_UNICODE);
    if (!stream || stream.getType() !== types.ePDFObjectStream) return null;
    var reference = font.queryObject(PdfName.TO_UNICODE);
    var objectId =
      reference.getType() === types.ePDFObjectIndirectObjectReference
        ? reference.toPDFIndirectObjectReference().getObjectID()
        : null;
    var cmap = objectId === null ? undefined : call.cmaps.get(objectId);
    if (!cmap) {
      var limit = Math.min(MAX_TO_UNICODE_BYTES, call.toUnicodeBytes);
      var source = contentStream.readStreamString(reader, stream, limit);
      if (source === null && limit < MAX_TO_UNICODE_BYTES) {
        // Too big for what is left of the budget; its real size is unknown.
        call.constrained = true;
        return null;
      }
      cmap =
        source === null
          ? { parsed: null, bytes: MAX_TO_UNICODE_BYTES }
          : { parsed: parseToUnicode(source), bytes: source.length };
      if (objectId !== null) call.cmaps.set(objectId, cmap);
    }
    var ranges = cmap.parsed ? cmap.parsed.rangeEntries : 0;
    if (cmap.bytes > call.toUnicodeBytes || ranges > call.rangeEntries) {
      call.constrained = true;
      return null;
    }
    call.toUnicodeBytes -= cmap.bytes;
    call.rangeEntries -= ranges;
    return cmap.parsed;
  } catch (error) {
    if (contentStream.isExtractionLimitError(error)) throw error;
    return null;
  }
}

/**
 * Read a simple font's `/Widths` array.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object} types PDF object type constants.
 * @param {object} widths `/Widths` entry.
 * @param {object|null} firstChar `/FirstChar` entry.
 * @param {object|null} lastChar `/LastChar` entry.
 * @returns {number[]|null} Widths from `/FirstChar` on, or null when the
 * array is malformed: not an array, without a numeric `/FirstChar`, longer
 * than 256 codes, shorter than `/FirstChar` to `/LastChar`, or holding an item
 * that is not a number.
 */
function readWidths(reader, types, widths, firstChar, lastChar) {
  if (
    widths.getType() !== types.ePDFObjectArray ||
    !isNumber(types, firstChar) ||
    widths.getLength() > 256 ||
    (isNumber(types, lastChar) &&
      widths.getLength() < Number(lastChar.value) - Number(firstChar.value) + 1)
  ) {
    return null;
  }
  var items = arrayItems(reader, types, widths, 256);
  var values = [];
  for (var index = 0; index < items.length; index++) {
    if (!isNumber(types, items[index])) return null;
    values.push(Number(items[index].value));
  }
  return values;
}

/**
 * Create a reader for a simple font's `/Widths`, used on the first encode.
 * Extraction never calls it, so it does not count against extraction limits.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object} types PDF object type constants.
 * @param {object} font Font dictionary.
 * @returns {function(): {values: number[]|null, firstChar: number, malformed:
 * boolean}} Reads the widths; `values` is null when the font has none.
 */
function widthsReader(reader, types, font) {
  /**
   * Read the font's widths.
   *
   * @returns {{values: number[]|null, firstChar: number, malformed:
   * boolean}} Widths.
   */
  function read() {
    var widths = entry(reader, font, PdfName.WIDTHS);
    if (!widths) return { values: null, firstChar: 0, malformed: false };
    var firstChar = entry(reader, font, PdfName.FIRST_CHAR);
    var values = readWidths(
      reader,
      types,
      widths,
      firstChar,
      entry(reader, font, PdfName.LAST_CHAR),
    );
    return {
      values: values,
      firstChar: isNumber(types, firstChar) ? Number(firstChar.value) : 0,
      malformed: values === null,
    };
  }
  return read;
}

/**
 * Describe one font dictionary for `createFontCodec`. Parts that cannot be
 * read are left out, so the codec falls back to the rest.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object} types PDF object type constants.
 * @param {object} font Font dictionary.
 * @param {{toUnicodeBytes: number, constrained: boolean}} call Decoding call
 * budget.
 * @returns {object} Font description.
 */
function describeFont(reader, types, font, call) {
  var subtype = entry(reader, font, PdfName.SUBTYPE);
  var subtypeName =
    subtype && subtype.getType() === types.ePDFObjectName
      ? subtype.value
      : null;
  var encoding = entry(reader, font, PdfName.ENCODING);
  var encodingName =
    encoding && encoding.getType() === types.ePDFObjectName
      ? encoding.value
      : null;
  var description = {
    composite: subtypeName === FontSubtype.TYPE0,
    identity:
      encodingName === FontEncoding.IDENTITY_H ||
      encodingName === FontEncoding.IDENTITY_V,
    toUnicode: readToUnicode(reader, types, font, call),
    baseEncoding: null,
    differences: [],
    readWidths: widthsReader(reader.plain || reader, types, font),
  };

  if (description.composite) return description;

  var builtIn = usesBuiltInEncoding(reader, types, font, subtypeName);
  if (encodingName) {
    description.baseEncoding = encodingName;
  } else if (encoding && encoding.getType() === types.ePDFObjectDictionary) {
    var base = entry(reader, encoding, PdfName.BASE_ENCODING);
    if (base && base.getType() === types.ePDFObjectName) {
      description.baseEncoding = base.value;
    } else if (!builtIn) {
      description.baseEncoding = FontEncoding.STANDARD;
    }
    description.differences = differencesEntries(
      reader,
      types,
      entry(reader, encoding, PdfName.DIFFERENCES),
    );
  } else if (!builtIn) {
    description.baseEncoding =
      subtypeName === FontSubtype.TRUE_TYPE
        ? FontEncoding.WIN_ANSI
        : FontEncoding.STANDARD;
  }

  return description;
}

// Per-reader codec cache by font object ID, least recently used first. Each
// entry records what building the codec cost, so a later call pays the same
// from its own budgets and gets the same result as if nothing were cached.
// Keyed weakly so ended readers are collected.
var readerCodecs = new WeakMap();

/**
 * Get the codec cache for a reader.
 *
 * @param {object} reader PDF reader or parser.
 * @returns {{entries: Map<number, {codec: object, objects: number,
 * toUnicodeBytes: number, rangeEntries: number, size: number}>, size:
 * number}} Cached codecs by font object ID, and their total decode-map size.
 */
function codecCache(reader) {
  var cache = readerCodecs.get(reader);
  if (!cache) {
    cache = { entries: new Map(), size: 0 };
    readerCodecs.set(reader, cache);
  }
  return cache;
}

/**
 * Get a cached codec and mark it most recently used.
 *
 * @param {{entries: Map, size: number}} cache Codec cache.
 * @param {number} objectId Font object ID.
 * @returns {object|undefined} Cache entry.
 */
function cachedCodec(cache, objectId) {
  var cached = cache.entries.get(objectId);
  if (cached) {
    cache.entries.delete(objectId);
    cache.entries.set(objectId, cached);
  }
  return cached;
}

/**
 * Cache a codec, dropping the least recently used ones past the limits.
 *
 * @param {{entries: Map, size: number}} cache Codec cache.
 * @param {number} objectId Font object ID.
 * @param {object} entry Cache entry with its `size`.
 * @returns {void}
 */
function cacheCodec(cache, objectId, entry) {
  cache.entries.set(objectId, entry);
  cache.size += entry.size;
  while (
    cache.entries.size > MAX_CACHED_FONTS ||
    cache.size > MAX_CACHED_ENTRIES
  ) {
    var oldest = cache.entries.keys().next().value;
    cache.size -= cache.entries.get(oldest).size;
    cache.entries.delete(oldest);
  }
}

/**
 * Wrap a reader so that decoding stops after reading `maxObjects` PDF objects.
 *
 * @param {object} reader PDF reader or parser.
 * @param {number} maxObjects Most PDF objects to read.
 * @returns {object} Reader with the methods decoding uses, `used()` and
 * `charge(count)` for the objects read so far and cached work, and `plain`,
 * the uncounted reader.
 */
function countingReader(reader, maxObjects) {
  var used = 0;

  /**
   * Count objects read.
   *
   * @param {number} count Number of objects.
   * @returns {void}
   * @throws {Error} If the budget is spent.
   */
  function charge(count) {
    used += count;
    if (used > maxObjects) throw contentStream.extractionLimitError();
  }

  /**
   * Report how many objects were counted.
   *
   * @returns {number} Objects counted so far.
   */
  function usedObjects() {
    return used;
  }

  /**
   * Read a dictionary entry, counting it.
   *
   * @param {object} dictionary PDF dictionary.
   * @param {string} key Entry name.
   * @returns {object|undefined} Resolved entry.
   */
  function queryDictionaryObject(dictionary, key) {
    charge(1);
    return reader.queryDictionaryObject(dictionary, key);
  }

  /**
   * Read an array item, counting it.
   *
   * @param {object} array PDF array.
   * @param {number} index Item index.
   * @returns {object|undefined} Resolved item.
   */
  function queryArrayObject(array, index) {
    charge(1);
    return reader.queryArrayObject(array, index);
  }

  /**
   * Parse an indirect object, counting it.
   *
   * @param {number} objectId Object ID.
   * @returns {object} Parsed object.
   */
  function parseNewObject(objectId) {
    charge(1);
    return reader.parseNewObject(objectId);
  }

  /**
   * Parse a page dictionary, counting it.
   *
   * @param {number} pageIndex Zero-based page index.
   * @returns {object} Page dictionary.
   */
  function parsePageDictionary(pageIndex) {
    charge(1);
    return reader.parsePageDictionary(pageIndex);
  }

  /**
   * Start reading a stream, counting it.
   *
   * @param {object} stream PDF stream.
   * @returns {object} Stream reader.
   */
  function startReadingFromStream(stream) {
    charge(1);
    return reader.startReadingFromStream(stream);
  }

  return {
    plain: reader,
    charge: charge,
    used: usedObjects,
    queryDictionaryObject: queryDictionaryObject,
    queryArrayObject: queryArrayObject,
    parseNewObject: parseNewObject,
    parsePageDictionary: parsePageDictionary,
    startReadingFromStream: startReadingFromStream,
  };
}

/**
 * Build the codec for one font resource. A font that cannot be resolved or
 * read decodes to U+FFFD and cannot encode.
 *
 * @param {object} reader Counting reader for this call.
 * @param {object} types PDF object type constants.
 * @param {object|null} fonts Font resource dictionary.
 * @param {string} name Font resource name.
 * @param {{cache: object, charged: Set<number>, cmaps: Map, toUnicodeBytes:
 * number, rangeEntries: number, constrained: boolean}} call The reader's codec
 * cache, fonts already paid for in this call, the CMaps parsed in it, and its
 * remaining budgets.
 * @returns {object} Font codec.
 * @throws {Error} If reading the font exceeds the extraction limits.
 */
function fontCodec(reader, types, fonts, name, call) {
  try {
    if (!fonts || typeof name !== "string" || !name || !fonts.exists(name)) {
      return UNREADABLE_CODEC;
    }
    var reference = fonts.queryObject(name);
    var objectId =
      reference.getType() === types.ePDFObjectIndirectObjectReference
        ? reference.toPDFIndirectObjectReference().getObjectID()
        : null;
    var cached = objectId === null ? null : cachedCodec(call.cache, objectId);
    if (cached && call.charged.has(objectId)) return cached.codec;
    if (
      cached &&
      cached.toUnicodeBytes <= call.toUnicodeBytes &&
      cached.rangeEntries <= call.rangeEntries
    ) {
      reader.charge(cached.objects);
      call.toUnicodeBytes -= cached.toUnicodeBytes;
      call.rangeEntries -= cached.rangeEntries;
      call.charged.add(objectId);
      return cached.codec;
    }

    var objects = reader.used();
    var toUnicodeBytes = call.toUnicodeBytes;
    var rangeEntries = call.rangeEntries;
    call.constrained = false;
    var font = reader.queryDictionaryObject(fonts, name);
    var description =
      font && font.getType() === types.ePDFObjectDictionary
        ? describeFont(reader, types, font, call)
        : null;
    var codec = description ? createFontCodec(description) : UNREADABLE_CODEC;
    if (objectId !== null) {
      call.charged.add(objectId);
      // A codec built from a squeezed budget is not what a fresh call gets.
      if (!call.constrained) {
        cacheCodec(call.cache, objectId, {
          codec: codec,
          objects: reader.used() - objects,
          toUnicodeBytes: toUnicodeBytes - call.toUnicodeBytes,
          rangeEntries: rangeEntries - call.rangeEntries,
          size: codec.size,
        });
      }
    }
    return codec;
  } catch (error) {
    if (contentStream.isExtractionLimitError(error)) throw error;
    return UNREADABLE_CODEC;
  }
}

/**
 * Create a font codec lookup for a page. Codecs are cached per reader by font
 * object, so fonts shared across pages and calls are read once. Each call
 * still pays a cached font's cost from its own budgets, so the result never
 * depends on earlier calls.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object} types PDF object type constants.
 * @param {number} pageIndex Zero-based page index.
 * @param {number} [maxParsedObjects] Most PDF objects decoding may read;
 * defaults to the extractor's ceiling.
 * @returns {function(string): {decode: function(string): string, encode:
 * function(string): string}} Codec lookup by font resource name; `encode`
 * errors name that resource.
 * @throws {Error} If reading the page's fonts exceeds `maxParsedObjects`.
 */
function createPageFontLookup(reader, types, pageIndex, maxParsedObjects) {
  var call = {
    cache: codecCache(reader),
    charged: new Set(),
    cmaps: new Map(),
    toUnicodeBytes: MAX_CALL_TO_UNICODE_BYTES,
    rangeEntries: MAX_CALL_RANGE_ENTRIES,
    constrained: false,
  };
  var counted = countingReader(
    reader,
    Math.min(maxParsedObjects || MAX_PARSED_OBJECTS, MAX_PARSED_OBJECTS),
  );
  var fonts = null;
  try {
    var resources = contentStream.inheritedResources(
      counted,
      types,
      counted.parsePageDictionary(pageIndex),
    );
    fonts = entry(counted, resources, PdfName.FONT);
    if (fonts && fonts.getType() !== types.ePDFObjectDictionary) fonts = null;
  } catch (error) {
    if (contentStream.isExtractionLimitError(error)) throw error;
    fonts = null;
  }
  var codecs = new Map();

  /**
   * Get the codec for a font resource name on this page.
   *
   * @param {string|null} name Font resource name, or null before any `Tf`.
   * @returns {{decode: function(string): string, encode: function(string):
   * string}} Font codec.
   */
  function lookupFont(name) {
    if (!codecs.has(name)) {
      var codec = fontCodec(counted, types, fonts, name, call);
      codecs.set(name, {
        decode: codec.decode,
        encode: encodeAs(codec, typeof name === "string" && name ? name : null),
      });
    }
    return codecs.get(name);
  }

  return lookupFont;
}

/**
 * Bind a codec's `encode` to the font resource name its errors report.
 *
 * @param {{encode: function(string, string): string}} codec Font codec.
 * @param {string|null} name Font resource name on the current page.
 * @returns {function(string): string} Encoder.
 */
function encodeAs(codec, name) {
  /**
   * Encode text through the font.
   *
   * @param {string} text Unicode text.
   * @returns {string} Operand bytes, one character per byte.
   */
  function encode(text) {
    return codec.encode(text, name);
  }
  return encode;
}

/**
 * Read the `decodeText` option of `extractPageText()`.
 *
 * @param {*} options Extraction options, or undefined.
 * @returns {boolean} False when decoding is turned off.
 * @throws {TypeError} If `options` is not an object or `decodeText` is not a
 * boolean.
 */
function decodeTextOption(options) {
  if (options === undefined) return true;
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new TypeError("Text extraction options must be an object");
  }
  if (options.decodeText === undefined) return true;
  if (typeof options.decodeText !== "boolean") {
    throw new TypeError("decodeText must be a boolean");
  }
  return options.decodeText;
}

/**
 * Add decoded Unicode `text` to extracted text elements.
 *
 * @param {object} reader PDF reader.
 * @param {object} types PDF object type constants.
 * @param {number} pageIndex Zero-based page index.
 * @param {Array<{content: string, fontResource: string}>} elements Extracted
 * elements.
 * @param {{maxParsedObjects?: number}} [limits] The caller's extraction limits.
 * @returns {Array<object>} The same elements with `text` set.
 * @throws {Error} If decoding reads more PDF objects than `maxParsedObjects`
 * allows.
 */
function decodeTextElements(reader, types, pageIndex, elements, limits) {
  if (!elements.length) return elements;
  var fonts = createPageFontLookup(
    reader,
    types,
    pageIndex,
    limits && limits.maxParsedObjects,
  );
  for (var index = 0; index < elements.length; index++) {
    var element = elements[index];
    element.text = fonts(element.fontResource).decode(element.content);
  }
  return elements;
}

export { createPageFontLookup, decodeTextElements, decodeTextOption };
