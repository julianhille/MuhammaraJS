// Decodes text-showing operand bytes through a page font and encodes text back
// into the same font. Mirrored in packages/wasm/lib/font-text.js; keep both
// files identical apart from the module syntax.

// PDF dictionary keys this module reads.
var PdfName = Object.freeze({
  BASE_ENCODING: "BaseEncoding",
  DIFFERENCES: "Differences",
  ENCODING: "Encoding",
  FIRST_CHAR: "FirstChar",
  FONT: "Font",
  PARENT: "Parent",
  RESOURCES: "Resources",
  SUBTYPE: "Subtype",
  TO_UNICODE: "ToUnicode",
  WIDTHS: "Widths",
});

// Font subtypes that change how codes are read.
var FontSubtype = Object.freeze({
  TYPE0: "Type0",
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

// ToUnicode CMap sections, named by their `begin...`/`end...` keywords.
var CMapSection = Object.freeze({
  CODESPACE_RANGE: "codespacerange",
  BF_CHAR: "bfchar",
  BF_RANGE: "bfrange",
});

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

// Glyph names outside ASCII and Latin-1 that the base encodings use.
var EXTRA_GLYPHS = {
  Euro: 0x20ac,
  quotesinglbase: 0x201a,
  florin: 0x0192,
  quotedblbase: 0x201e,
  ellipsis: 0x2026,
  dagger: 0x2020,
  daggerdbl: 0x2021,
  circumflex: 0x02c6,
  perthousand: 0x2030,
  Scaron: 0x0160,
  guilsinglleft: 0x2039,
  OE: 0x0152,
  Zcaron: 0x017d,
  quoteleft: 0x2018,
  quoteright: 0x2019,
  quotedblleft: 0x201c,
  quotedblright: 0x201d,
  bullet: 0x2022,
  endash: 0x2013,
  emdash: 0x2014,
  tilde: 0x02dc,
  trademark: 0x2122,
  scaron: 0x0161,
  guilsinglright: 0x203a,
  oe: 0x0153,
  zcaron: 0x017e,
  Ydieresis: 0x0178,
  notequal: 0x2260,
  infinity: 0x221e,
  lessequal: 0x2264,
  greaterequal: 0x2265,
  partialdiff: 0x2202,
  summation: 0x2211,
  product: 0x220f,
  pi: 0x03c0,
  integral: 0x222b,
  Omega: 0x03a9,
  radical: 0x221a,
  approxequal: 0x2248,
  Delta: 0x2206,
  lozenge: 0x25ca,
  fraction: 0x2044,
  fi: 0xfb01,
  fl: 0xfb02,
  apple: 0xf8ff,
  dotlessi: 0x0131,
  breve: 0x02d8,
  dotaccent: 0x02d9,
  ring: 0x02da,
  hungarumlaut: 0x02dd,
  ogonek: 0x02db,
  caron: 0x02c7,
  Lslash: 0x0141,
  lslash: 0x0142,
  minus: 0x2212,
  space: 0x20,
};

var GLYPHS = Object.create(null);
ASCII_NAMES.forEach(function (name, index) {
  GLYPHS[name] = 0x20 + index;
});
LATIN1_NAMES.forEach(function (name, index) {
  GLYPHS[name] = 0xa0 + index;
});
Object.keys(EXTRA_GLYPHS).forEach(function (name) {
  GLYPHS[name] = EXTRA_GLYPHS[name];
});

/**
 * Build a 256-entry glyph-name table from ASCII plus high-byte overrides.
 *
 * @param {Object<number, string>} overrides Code-to-name overrides.
 * @param {string[]} [high] Names for codes 0x80 to 0xFF, `.` for unused.
 * @returns {Array<string|undefined>} Glyph names indexed by code.
 */
function encodingTable(overrides, high) {
  var table = new Array(256);
  ASCII_NAMES.forEach(function (name, index) {
    table[0x20 + index] = name;
  });
  (high || []).forEach(function (name, index) {
    table[0x80 + index] = name === "." ? undefined : name;
  });
  Object.keys(overrides).forEach(function (code) {
    table[code] = overrides[code];
  });
  return table;
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
  if (base in GLYPHS) return String.fromCodePoint(GLYPHS[base]);
  var match = /^uni((?:[0-9A-F]{4})+)$/.exec(base);
  if (match) {
    return match[1].replace(/[0-9A-F]{4}/g, function (hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });
  }
  match = /^u([0-9A-F]{4,6})$/.exec(base);
  if (match) {
    var codePoint = parseInt(match[1], 16);
    if (codePoint <= 0x10ffff) return String.fromCodePoint(codePoint);
  }
  return undefined;
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
  var pattern =
    /%[^\r\n]*|<([0-9A-Fa-f\s]*)>|\/([^\s()<>[\]{}/%]*)|([[\]])|\((?:\\.|[^\\)])*\)|([^\s()<>[\]{}/%]+)/g;
  var match;
  while ((match = pattern.exec(source))) {
    if (match[1] !== undefined) {
      var hex = match[1].replace(/\s+/g, "");
      if (hex.length % 2) hex += "0";
      var bytes = "";
      for (var index = 0; index < hex.length; index += 2) {
        bytes += String.fromCharCode(parseInt(hex.slice(index, index + 2), 16));
      }
      tokens.push({ type: CMapToken.HEX, value: bytes });
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
 * string>}} Codespace ranges and code-to-text mappings keyed by code bytes.
 */
function parseToUnicode(source) {
  var tokens = cmapTokens(source);
  var sections = Object.values(CMapSection);
  var codespace = [];
  var map = new Map();
  var mode = null;
  var operands = [];
  var rangeBudget = MAX_RANGE_ENTRIES;

  tokens.forEach(function (token) {
    if (token.type === CMapToken.KEYWORD) {
      if (
        token.value.startsWith("begin") &&
        sections.includes(token.value.slice(5))
      ) {
        mode = token.value.slice(5);
        operands = [];
      } else if (
        token.value.startsWith("end") &&
        sections.includes(token.value.slice(3))
      ) {
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
  });

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
    for (var code = start; code <= end; code++) {
      var text;
      if (Array.isArray(destination)) {
        var item = destination[code - start];
        text = item && destinationText(item);
      } else if (
        destination.type === CMapToken.HEX &&
        destination.value.length
      ) {
        text = offsetDestination(utf16be(destination.value), code - start);
      } else {
        text = code === start ? destinationText(destination) : undefined;
      }
      if (text !== undefined) map.set(codeBytes(code, length), text);
    }
  }

  return { codespace: codespace, map: map };
}

/**
 * Convert a `bfchar` or `bfrange` destination token to text.
 *
 * @param {{type: string, value: string}} token Destination token.
 * @returns {string|undefined} Text, or undefined when not decodable.
 */
function destinationText(token) {
  if (token.type === CMapToken.HEX) return utf16be(token.value);
  if (token.type === CMapToken.NAME) return glyphNameToUnicode(token.value);
  return undefined;
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
 * @param {string} description.name Font resource name, for errors.
 * @param {boolean} description.composite True for Type0 fonts.
 * @param {boolean} description.identity True for Type0 fonts with an
 * `Identity-H` or `Identity-V` encoding.
 * @param {string|null} description.toUnicode One-byte ToUnicode CMap stream.
 * @param {string|null} description.baseEncoding Simple-font base encoding
 * name.
 * @param {Array<number|string>} description.differences Flattened
 * `/Differences` array.
 * @param {number} description.firstChar First code in `widths`.
 * @param {number[]|null} description.widths Simple-font glyph widths.
 * @returns {{decode: function(string): string, encode: function(string):
 * string}} Font codec.
 */
function createFontCodec(description) {
  var toUnicode = description.toUnicode
    ? parseToUnicode(description.toUnicode)
    : { codespace: [], map: new Map() };
  var codeLength = description.composite ? 2 : 1;
  var codespace = toUnicode.codespace;
  if (!description.composite) {
    codespace = [{ low: "\x00", high: "\xff" }];
  } else if (description.identity) {
    // Identity-H and Identity-V read every code as two bytes, whatever
    // codespace the ToUnicode CMap declares.
    codespace = [{ low: "\x00\x00", high: "\xff\xff" }];
  }
  var decodeMap = new Map(toUnicode.map);

  if (!description.composite) {
    var names = (
      BASE_ENCODINGS.get(description.baseEncoding) || STANDARD
    ).slice();
    var code = 0;
    description.differences.forEach(function (entry) {
      if (typeof entry === "number") {
        code = entry;
      } else if (code < 256) {
        names[code++] = entry;
      }
    });
    names.forEach(function (name, index) {
      var bytes = String.fromCharCode(index);
      var text = name && glyphNameToUnicode(name);
      if (text !== undefined && !decodeMap.has(bytes)) {
        decodeMap.set(bytes, text);
      }
    });
  }

  var encodeMap = new Map();
  var longestText = 1;
  decodeMap.forEach(function (text, bytes) {
    if (!text || encodeMap.has(text) || !hasGlyph(bytes)) return;
    encodeMap.set(text, bytes);
    longestText = Math.max(longestText, text.length);
  });

  /**
   * Check a simple-font code against `/Widths`; subset fonts write zero for
   * glyphs they leave out.
   *
   * @param {string} bytes Code bytes.
   * @returns {boolean} True when the font can show the code.
   */
  function hasGlyph(bytes) {
    if (description.composite || !description.widths) return true;
    var width = description.widths[bytes.charCodeAt(0) - description.firstChar];
    return typeof width === "number" && width > 0;
  }

  return {
    decode: function (bytes) {
      return splitCodes(bytes, codespace, codeLength)
        .map(function (code) {
          var text = decodeMap.get(code);
          return text === undefined ? "�" : text;
        })
        .join("");
    },
    encode: function (text) {
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
          if (missing.indexOf(character) === -1) missing.push(character);
          index += character.length;
        }
      }
      if (missing.length) {
        throw new Error(
          "font " +
            description.name +
            " has no glyph for " +
            missing
              .map(function (character) {
                return JSON.stringify(character);
              })
              .join(", "),
        );
      }
      return bytes;
    },
  };
}

/**
 * Codec for text with no resolvable font: one byte per Latin-1 character.
 */
var LATIN1_CODEC = {
  decode: function (bytes) {
    return bytes;
  },
  encode: function (text) {
    if (/[^\u0000-ÿ]/.test(text)) {
      throw new Error(
        "text without a resolvable font supports only Latin-1 characters",
      );
    }
    return text;
  },
};

/**
 * Read a whole stream as a one-byte string.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object} stream PDF stream object.
 * @returns {string} Decoded stream bytes, one character per byte.
 */
function readStream(reader, stream) {
  var streamReader = reader.startReadingFromStream(stream);
  var source = "";
  try {
    while (streamReader.notEnded()) {
      var chunk = streamReader.read(65536);
      for (var offset = 0; offset < chunk.length; offset += 0x8000) {
        source += String.fromCharCode.apply(
          null,
          Array.prototype.slice.call(chunk, offset, offset + 0x8000),
        );
      }
    }
  } finally {
    if (typeof streamReader.dispose === "function") streamReader.dispose();
  }
  return source;
}

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
 * Read a resolved array as a list of PDF objects.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object|null} array PDF array.
 * @returns {object[]} Resolved items.
 */
function arrayItems(reader, array) {
  var items = [];
  for (var index = 0; array && index < array.getLength(); index++) {
    items.push(reader.queryArrayObject(array, index));
  }
  return items;
}

/**
 * Describe one font dictionary for `createFontCodec`.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object} types PDF object type constants.
 * @param {string} name Font resource name.
 * @param {object} font Font dictionary.
 * @returns {object} Font description.
 */
function describeFont(reader, types, name, font) {
  var subtype = entry(reader, font, PdfName.SUBTYPE);
  var toUnicode = entry(reader, font, PdfName.TO_UNICODE);
  var encoding = entry(reader, font, PdfName.ENCODING);
  var encodingName =
    encoding && encoding.getType() === types.ePDFObjectName
      ? encoding.value
      : null;
  var description = {
    name: name,
    composite: Boolean(subtype && subtype.value === FontSubtype.TYPE0),
    identity:
      encodingName === FontEncoding.IDENTITY_H ||
      encodingName === FontEncoding.IDENTITY_V,
    toUnicode:
      toUnicode && toUnicode.getType() === types.ePDFObjectStream
        ? readStream(reader, toUnicode)
        : null,
    baseEncoding: null,
    differences: [],
    firstChar: 0,
    widths: null,
  };

  if (description.composite) return description;

  if (!encoding) {
    description.baseEncoding =
      subtype && subtype.value === FontSubtype.TRUE_TYPE
        ? FontEncoding.WIN_ANSI
        : FontEncoding.STANDARD;
  } else if (encodingName) {
    description.baseEncoding = encodingName;
  } else if (encoding.getType() === types.ePDFObjectDictionary) {
    var base = entry(reader, encoding, PdfName.BASE_ENCODING);
    description.baseEncoding = base ? base.value : FontEncoding.STANDARD;
    description.differences = arrayItems(
      reader,
      entry(reader, encoding, PdfName.DIFFERENCES),
    ).map(function (item) {
      return item.getType() === types.ePDFObjectName
        ? item.value
        : Number(item.value);
    });
  }

  var firstChar = entry(reader, font, PdfName.FIRST_CHAR);
  var widths = entry(reader, font, PdfName.WIDTHS);
  if (firstChar && widths && widths.getType() === types.ePDFObjectArray) {
    description.firstChar = Number(firstChar.value);
    description.widths = arrayItems(reader, widths).map(function (item) {
      return Number(item.value);
    });
  }
  return description;
}

/**
 * Create a lookup from font resource names to codecs for a resources
 * dictionary. Codecs are built on first use and cached.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object} types PDF object type constants.
 * @param {object|null} resources Resources dictionary.
 * @returns {function(string): object} Codec lookup; unknown names get a
 * Latin-1 codec.
 */
function createFontLookup(reader, types, resources) {
  var fonts = entry(reader, resources, PdfName.FONT);
  var codecs = new Map();
  return function (name) {
    if (!codecs.has(name)) {
      var font = typeof name === "string" ? entry(reader, fonts, name) : null;
      codecs.set(
        name,
        font && font.getType() === types.ePDFObjectDictionary
          ? createFontCodec(describeFont(reader, types, name, font))
          : LATIN1_CODEC,
      );
    }
    return codecs.get(name);
  };
}

/**
 * Find a page's resources dictionary, following inheritance.
 *
 * @param {object} reader PDF reader or parser.
 * @param {number} pageIndex Zero-based page index.
 * @returns {object|null} Resources dictionary.
 */
function pageResources(reader, pageIndex) {
  for (
    var node = reader.parsePageDictionary(pageIndex);
    node;
    node = entry(reader, node, PdfName.PARENT)
  ) {
    var resources = entry(reader, node, PdfName.RESOURCES);
    if (resources) return resources;
  }
  return null;
}

/**
 * Create a font codec lookup for a page.
 *
 * @param {object} reader PDF reader or parser.
 * @param {object} types PDF object type constants.
 * @param {number} pageIndex Zero-based page index.
 * @returns {function(string): object} Codec lookup.
 */
function createPageFontLookup(reader, types, pageIndex) {
  return createFontLookup(reader, types, pageResources(reader, pageIndex));
}

/**
 * Add decoded Unicode `text` to extracted text elements.
 *
 * @param {object} reader PDF reader.
 * @param {object} types PDF object type constants.
 * @param {number} pageIndex Zero-based page index.
 * @param {Array<{content: string, fontResource: string}>} elements Extracted
 * elements.
 * @returns {Array<object>} The same elements with `text` set.
 */
function decodeTextElements(reader, types, pageIndex, elements) {
  var fonts = elements.length
    ? createPageFontLookup(reader, types, pageIndex)
    : null;
  elements.forEach(function (element) {
    element.text = fonts(element.fontResource).decode(element.content);
  });
  return elements;
}

module.exports = {
  createPageFontLookup: createPageFontLookup,
  decodeTextElements: decodeTextElements,
};
