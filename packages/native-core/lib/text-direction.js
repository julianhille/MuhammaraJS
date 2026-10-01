// Reorders right-to-left text, such as Hebrew, from the order it is typed in
// to the left-to-right order PDF draws glyphs in. Mirrored in
// packages/wasm/lib/text-direction.js; keep both files identical apart from
// the module syntax.

var bidiFactory = require("bidi-js");

// How text is ordered before it is written.
var TextDirection = Object.freeze({
  // The first strong letter of each paragraph picks its direction.
  AUTO: "auto",
  LTR: "ltr",
  RTL: "rtl",
  // Write the text exactly as given, for text that is already in visual order.
  NONE: "none",
});

var DIRECTIONS = Object.keys(TextDirection).map(function (key) {
  return TextDirection[key];
});

// Characters that can change the order text is drawn in: right-to-left
// letters, Arabic digits and the bidirectional formatting characters. Text
// without any of them draws exactly as typed in a left-to-right paragraph.
// bidi-js classifies UTF-16 code units, so right-to-left scripts outside the
// Basic Multilingual Plane are not reordered and are not listed.
var REORDERING_CHARACTER =
  /[\u0590-\u08ff\u200e\u200f\u202a-\u202e\u2066-\u2069\ufb1d-\ufdff\ufe70-\ufefe]/;

// Invisible bidirectional formatting characters. They only steer the
// reordering, so they are dropped instead of drawn as missing glyphs.
var FORMATTING_CHARACTER = /^[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]$/;

// Marks that combine with the character before them, such as Hebrew points.
var COMBINING_MARK = /^\p{M}$/u;

// The breaks that end a paragraph; the same mandatory breaks Recipe wraps at.
var PARAGRAPH_BREAK = /\r\n|[\n\v\f\r\u0085\u2028\u2029]/g;
// The same breaks, captured, to split text into paragraphs and breaks.
var PARAGRAPH_SPLIT = /(\r\n|[\n\v\f\r\u0085\u2028\u2029])/;

var bidi = null;

/**
 * The bidi-js instance, created on first use.
 *
 * @returns {object} The bidi-js API.
 */
function getBidi() {
  if (!bidi) bidi = bidiFactory();
  return bidi;
}

/**
 * Validate a `direction` option.
 *
 * @param {*} value The option value; undefined and null mean "auto".
 * @returns {string} A `TextDirection` value.
 * @throws {TypeError} If the value is not a `TextDirection` value.
 */
function readDirection(value) {
  if (value === undefined || value === null) return TextDirection.AUTO;
  if (DIRECTIONS.indexOf(value) === -1) {
    throw new TypeError('direction must be "auto", "ltr", "rtl" or "none"');
  }
  return value;
}

/**
 * Whether text contains characters that can change its drawing order.
 *
 * @param {string} text The text.
 * @returns {boolean} True for text with right-to-left or formatting characters.
 */
function hasReorderingCharacters(text) {
  return REORDERING_CHARACTER.test(text);
}

/**
 * The direction of a paragraph: an explicit direction as given, or for
 * "auto" the direction of its first strong letter, left to right without one.
 *
 * @param {string} text The paragraph.
 * @param {string} [direction] A `TextDirection` value; defaults to "auto".
 * @returns {string} "ltr", "rtl" or "none".
 * @throws {TypeError} If `direction` is not a `TextDirection` value.
 */
function resolveDirection(text, direction) {
  direction = readDirection(direction);
  if (direction !== TextDirection.AUTO) return direction;
  if (!hasReorderingCharacters(text)) return TextDirection.LTR;
  return getBidi().getEmbeddingLevels(text).paragraphs[0].level % 2
    ? TextDirection.RTL
    : TextDirection.LTR;
}

/**
 * Resolve the direction of every paragraph in a text, so lines wrapped out of
 * a paragraph keep its direction.
 *
 * @param {string} text The text.
 * @param {string} [direction] A `TextDirection` value; defaults to "auto".
 * @returns {function(number): string} Returns the resolved direction of the
 * paragraph holding a UTF-16 offset of `text`.
 * @throws {TypeError} If `direction` is not a `TextDirection` value.
 */
function paragraphDirections(text, direction) {
  direction = readDirection(direction);
  if (direction !== TextDirection.AUTO || !hasReorderingCharacters(text)) {
    var fixed = resolveDirection("", direction);
    return function () {
      return fixed;
    };
  }
  var paragraphs = [];
  var start = 0;
  var match;
  PARAGRAPH_BREAK.lastIndex = 0;
  while ((match = PARAGRAPH_BREAK.exec(text))) {
    var end = match.index + match[0].length;
    paragraphs.push({
      end: end,
      direction: resolveDirection(text.slice(start, match.index)),
    });
    start = end;
  }
  paragraphs.push({
    end: Infinity,
    direction: resolveDirection(text.slice(start)),
  });
  return function (offset) {
    for (var index = 0; index < paragraphs.length; ++index) {
      if (offset < paragraphs[index].end) return paragraphs[index].direction;
    }
    return paragraphs[paragraphs.length - 1].direction;
  };
}

/**
 * The first UTF-16 index of the cluster each index belongs to. A cluster is a
 * character with the combining marks that follow it, so reordering never
 * moves a mark off its letter or splits a surrogate pair.
 *
 * @param {string} text The text.
 * @returns {number[]} The cluster start of every index.
 */
function clusterStarts(text) {
  var starts = new Array(text.length);
  var start = 0;
  for (var index = 0; index < text.length; ++index) {
    var code = text.charCodeAt(index);
    var previous = index > 0 ? text.charCodeAt(index - 1) : 0;
    var lowSurrogate =
      code >= 0xdc00 &&
      code <= 0xdfff &&
      previous >= 0xd800 &&
      previous <= 0xdbff;
    if (
      index === 0 ||
      !(
        lowSurrogate ||
        COMBINING_MARK.test(String.fromCodePoint(text.codePointAt(index)))
      )
    ) {
      start = index;
    }
    starts[index] = start;
  }
  return starts;
}

/**
 * Reorder one paragraph, without its edge whitespace, to visual order.
 *
 * @param {string} core The paragraph text.
 * @param {string} direction "auto", "ltr" or "rtl".
 * @returns {string} The paragraph in visual order.
 */
function reorderParagraph(core, direction) {
  var api = getBidi();
  var levels = api.getEmbeddingLevels(
    core,
    direction === TextDirection.AUTO ? undefined : direction,
  );
  var order = api.getReorderedIndices(core, levels);
  var mirrored = api.getMirroredCharactersMap(core, levels.levels);
  var starts = clusterStarts(core);
  var written = new Array(core.length);
  var visual = "";
  order.forEach(function (index) {
    var start = starts[index];
    if (written[start]) return;
    written[start] = true;
    for (
      var position = start;
      position < core.length && starts[position] === start;
      ++position
    ) {
      var character = core[position];
      if (!FORMATTING_CHARACTER.test(character)) {
        visual += mirrored.get(position) || character;
      }
    }
  });
  return visual;
}

/**
 * Reorder one line of text from logical to visual order with the Unicode
 * Bidirectional Algorithm. Right-to-left runs are reversed, numbers and
 * left-to-right words inside them keep their order, brackets in right-to-left
 * runs are mirrored, combining marks stay on their letter, and formatting
 * characters are dropped. Whitespace at either end of the text stays where it
 * is, so measuring and aligning the line are unchanged. Text holding
 * paragraph breaks is reordered paragraph by paragraph, and the breaks stay
 * in place.
 *
 * @param {string} text One line of text in logical order.
 * @param {string} [direction] A `TextDirection` value; defaults to "auto".
 * @returns {string} The text in visual order; unchanged for "none" and for
 * left-to-right text.
 * @throws {TypeError} If `direction` is not a `TextDirection` value.
 */
function toVisual(text, direction) {
  direction = readDirection(direction);
  if (typeof text !== "string" || direction === TextDirection.NONE) {
    return text;
  }
  if (direction !== TextDirection.RTL && !hasReorderingCharacters(text)) {
    return text;
  }
  // Odd entries are the paragraph breaks themselves.
  return text
    .split(PARAGRAPH_SPLIT)
    .map(function (part, index) {
      if (index % 2) return part;
      var edges = /^(\s*)([\s\S]*?)(\s*)$/.exec(part);
      if (!edges[2]) return part;
      return edges[1] + reorderParagraph(edges[2], direction) + edges[3];
    })
    .join("");
}

module.exports = {
  TextDirection: TextDirection,
  readDirection: readDirection,
  hasReorderingCharacters: hasReorderingCharacters,
  resolveDirection: resolveDirection,
  paragraphDirections: paragraphDirections,
  toVisual: toVisual,
};
