// Reorders right-to-left text, such as Hebrew, from the order it is typed in
// to the left-to-right order PDF draws glyphs in. Mirrored in
// packages/native-core/lib/text-direction.js; keep both files identical apart
// from the module syntax.

import bidiFactory from "./vendor/bidi-js.js";

// How text is ordered before it is written.
var TextDirection = Object.freeze({
  // The first strong letter of each paragraph picks its direction.
  AUTO: "auto",
  LTR: "ltr",
  RTL: "rtl",
  // Write the text exactly as given, for text that is already in visual
  // order. The default, so text is drawn as it was before reordering existed.
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
// The same characters, to remove them from a whole text.
var FORMATTING_CHARACTERS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

// Marks that combine with the character before them, such as Hebrew points.
var COMBINING_MARK = /^\p{M}$/u;

// The breaks that end a paragraph; the same mandatory breaks Recipe wraps at.
var PARAGRAPH_BREAK = /\r\n|[\n\v\f\r\u0085\u2028\u2029]/g;
// The same breaks, captured, to split text into paragraphs and breaks.
var PARAGRAPH_SPLIT = /(\r\n|[\n\v\f\r\u0085\u2028\u2029])/;
// Whitespace a line may break at; non-breaking spaces belong to their word.
var BREAKABLE_SPACE = /^(?:(?![\u00a0\u2007\u202f])\s)+/;
var TRAILING_BREAKABLE_SPACE = /(?:(?![\u00a0\u2007\u202f])\s)+$/;

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
 * @param {*} value The option value; undefined and null mean "none".
 * @returns {string} A `TextDirection` value.
 * @throws {TypeError} If the value is not a `TextDirection` value.
 */
function readDirection(value) {
  if (value === undefined || value === null) return TextDirection.NONE;
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
 * @param {string} [direction] A `TextDirection` value; defaults to "none".
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
 * @param {string} [direction] A `TextDirection` value; defaults to "none".
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
      direction: resolveDirection(
        text.slice(start, match.index),
        TextDirection.AUTO,
      ),
    });
    start = end;
  }
  paragraphs.push({
    end: Infinity,
    direction: resolveDirection(text.slice(start), TextDirection.AUTO),
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
 * moves a mark off its letter or splits a surrogate pair. Formatting
 * characters are dropped when drawn, so a mark after one joins the character
 * before the formatting character.
 *
 * @param {string} text The text.
 * @returns {number[]} The cluster start of every index.
 */
function clusterStarts(text) {
  var starts = new Array(text.length);
  // The start of the last cluster that is drawn, if any.
  var base = -1;
  for (var index = 0; index < text.length; ++index) {
    var lowSurrogate = isLowSurrogateAt(text, index);
    if (FORMATTING_CHARACTER.test(text[index])) {
      starts[index] = index;
    } else if (
      base !== -1 &&
      (lowSurrogate ||
        COMBINING_MARK.test(String.fromCodePoint(text.codePointAt(index))))
    ) {
      starts[index] = base;
    } else {
      base = index;
      starts[index] = index;
    }
  }
  return starts;
}

/**
 * Whether a UTF-16 index holds the low half of a surrogate pair.
 *
 * @param {string} text The text.
 * @param {number} index The index.
 * @returns {boolean} True for a low surrogate that follows a high one.
 */
function isLowSurrogateAt(text, index) {
  var code = text.charCodeAt(index);
  var previous = index > 0 ? text.charCodeAt(index - 1) : 0;
  return (
    code >= 0xdc00 && code <= 0xdfff && previous >= 0xd800 && previous <= 0xdbff
  );
}

/**
 * The indices of every cluster, keyed by its start.
 *
 * @param {number[]} starts The cluster start of every index.
 * @returns {Object<number, number[]>} The member indices of each cluster.
 */
function clusterMembers(starts) {
  var members = {};
  starts.forEach(function (start, index) {
    (members[start] = members[start] || []).push(index);
  });
  return members;
}

/**
 * The characters of one paragraph, without its edge whitespace, in visual
 * order: combining marks stay with their letter, before it in right-to-left
 * runs and after it otherwise, brackets in right-to-left runs are mirrored,
 * and formatting characters are dropped.
 *
 * @param {string} core The paragraph text.
 * @param {string} direction "auto", "ltr" or "rtl".
 * @returns {Array<{index: number, character: string}>} Each drawn
 * character with its UTF-16 index in `core`, from left to right.
 */
function visualCharacters(core, direction) {
  var api = getBidi();
  var levels = api.getEmbeddingLevels(
    core,
    direction === TextDirection.AUTO ? undefined : direction,
  );
  var order = api.getReorderedIndices(core, levels);
  var mirrored = api.getMirroredCharactersMap(core, levels.levels);
  var starts = clusterStarts(core);
  var members = clusterMembers(starts);
  var written = new Array(core.length);
  var visual = [];
  order.forEach(function (index) {
    var start = starts[index];
    if (written[start]) return;
    written[start] = true;
    var cluster = members[start];
    if (levels.levels[start] % 2) {
      // Right-to-left fonts place a mark over the glyph drawn after it, so
      // in a right-to-left run the marks come first, as the bidirectional
      // algorithm orders them; a surrogate pair keeps its order.
      var base = cluster.filter(function (position) {
        return position === start || isLowSurrogateAt(core, position);
      });
      cluster = cluster
        .filter(function (position) {
          return base.indexOf(position) === -1;
        })
        .reverse()
        .concat(base);
    }
    cluster.forEach(function (position) {
      var character = core[position];
      if (!FORMATTING_CHARACTER.test(character)) {
        visual.push({
          index: position,
          character: mirrored.get(position) || character,
        });
      }
    });
  });
  return visual;
}

/**
 * Reorder one paragraph, without its edge whitespace, to visual order.
 *
 * @param {string} core The paragraph text.
 * @param {string} direction "auto", "ltr" or "rtl".
 * @returns {string} The paragraph in visual order.
 */
function reorderParagraph(core, direction) {
  return visualCharacters(core, direction)
    .map(function (entry) {
      return entry.character;
    })
    .join("");
}

/**
 * Whether `toVisual()` would change a text.
 *
 * @param {string} text The text.
 * @param {string} direction A validated `TextDirection` value.
 * @returns {boolean} False for "none" and for left-to-right text.
 */
function reorders(text, direction) {
  if (typeof text !== "string" || direction === TextDirection.NONE) {
    return false;
  }
  return direction === TextDirection.RTL || hasReorderingCharacters(text);
}

/**
 * Reorder one line of text from logical to visual order with the Unicode
 * Bidirectional Algorithm. Right-to-left runs are reversed, numbers and
 * left-to-right words inside them keep their order, brackets in right-to-left
 * runs are mirrored, combining marks stay on their letter (drawn before it in
 * right-to-left runs, where fonts expect them), and formatting
 * characters are dropped. Whitespace at either end of the text stays where it
 * is, so measuring and aligning the line are unchanged. Text holding
 * paragraph breaks is reordered paragraph by paragraph, and the breaks stay
 * in place.
 *
 * @param {string} text One line of text in logical order.
 * @param {string} [direction] A `TextDirection` value; defaults to "none".
 * @returns {string} The text in visual order; unchanged for "none" and for
 * left-to-right text.
 * @throws {TypeError} If `direction` is not a `TextDirection` value.
 */
function toVisual(text, direction) {
  direction = readDirection(direction);
  if (!reorders(text, direction)) return text;
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

/**
 * The characters `toVisual()` draws, still in logical order: the text without
 * its formatting characters, or unchanged for "none". Measure this text, not
 * the original, so a measured width matches the drawn one.
 *
 * @param {string} text The text.
 * @param {string} [direction] A `TextDirection` value; defaults to "none".
 * @returns {string} The text to measure.
 * @throws {TypeError} If `direction` is not a `TextDirection` value.
 */
function drawnText(text, direction) {
  direction = readDirection(direction);
  if (!reorders(text, direction)) return text;
  return text.replace(FORMATTING_CHARACTERS, "");
}

/**
 * Reorder a line made of several runs, such as the styled runs of HTML text,
 * as one line. Each returned segment is a piece of one run, already in visual
 * order, and the segments are listed from left to right. Whitespace that
 * would start a segment ends the segment before it instead, so, as in logical
 * order, a segment ends with the space that follows its word. Whitespace at
 * either end of the line stays where it is, as in `toVisual()`.
 *
 * @param {string[]} texts The runs of the line in logical order.
 * @param {string} [direction] A `TextDirection` value; defaults to "none".
 * "auto" takes the direction of the line's first strong letter.
 * @returns {Array<{run: number, text: string}>|null} The segments, with the
 * index of the run each one belongs to, or null when the line keeps its
 * logical order: for "none", for left-to-right text, and for a line holding a
 * paragraph break.
 * @throws {TypeError} If `direction` is not a `TextDirection` value.
 */
function visualRuns(texts, direction) {
  direction = readDirection(direction);
  var line = texts.join("");
  if (!reorders(line, direction)) return null;
  PARAGRAPH_BREAK.lastIndex = 0;
  if (PARAGRAPH_BREAK.test(line)) return null;
  var owners = [];
  texts.forEach(function (text, run) {
    for (var index = 0; index < text.length; ++index) owners.push(run);
  });
  var edges = /^(\s*)([\s\S]*?)(\s*)$/.exec(line);
  var leading = edges[1].length;
  var characters = [];
  var index;
  for (index = 0; index < leading; ++index) {
    characters.push({ index: index, character: line[index] });
  }
  if (edges[2]) {
    visualCharacters(edges[2], direction).forEach(function (entry) {
      characters.push({
        index: entry.index + leading,
        character: entry.character,
      });
    });
  }
  for (index = leading + edges[2].length; index < line.length; ++index) {
    characters.push({ index: index, character: line[index] });
  }
  var segments = [];
  characters.forEach(function (entry) {
    var run = owners[entry.index];
    var last = segments[segments.length - 1];
    if (last && last.run === run) last.text += entry.character;
    else segments.push({ run: run, text: entry.character });
  });
  for (index = 1; index < segments.length; ++index) {
    var space = BREAKABLE_SPACE.exec(segments[index].text);
    if (space) {
      segments[index - 1].text += space[0];
      segments[index].text = segments[index].text.slice(space[0].length);
    }
  }
  return segments.filter(function (segment) {
    return segment.text !== "";
  });
}

/**
 * Split visual segments into words, each ending with the breakable
 * whitespace that follows it, so justification can widen the gaps between
 * words. Non-breaking spaces stay inside their word.
 *
 * @param {Array<{run: number, text: string}>} segments Segments from
 * `visualRuns()`.
 * @returns {Array<{run: number, text: string, gap: boolean}>} The words from
 * left to right; `gap` marks a visible word followed by breakable whitespace
 * and more text, whose gap justification may widen.
 */
function visualWords(segments) {
  var words = [];
  segments.forEach(function (segment) {
    var pattern =
      /(?:(?![\u00a0\u2007\u202f])\s)*(?:[^\s]|[\u00a0\u2007\u202f])+(?:(?![\u00a0\u2007\u202f])\s)*|\s+/g;
    var match;
    while ((match = pattern.exec(segment.text))) {
      words.push({ run: segment.run, text: match[0], gap: false });
    }
  });
  words.forEach(function (word, index) {
    word.gap =
      word.text.trim() !== "" &&
      TRAILING_BREAKABLE_SPACE.test(word.text) &&
      words.slice(index + 1).some(function (next) {
        return next.text.trim() !== "";
      });
  });
  return words;
}

export {
  TextDirection,
  readDirection,
  hasReorderingCharacters,
  resolveDirection,
  paragraphDirections,
  toVisual,
  drawnText,
  visualRuns,
  visualWords,
};
