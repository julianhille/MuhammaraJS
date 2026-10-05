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
// letters, Arabic digits and the bidirectional formatting characters,
// including the right-to-left scripts outside the Basic Multilingual Plane,
// U+10800-U+10FFF and U+1E800-U+1EFFF, matched by their high surrogates. Text
// without any of them draws exactly as typed in a left-to-right paragraph.
var REORDERING_CHARACTER =
  /[\u0590-\u08ff\u200e\u200f\u202a-\u202e\u2066-\u2069\ufb1d-\ufdff\ufe70-\ufefe\ud802\ud803\ud83a\ud83b]/;

// Invisible bidirectional formatting characters. They only steer the
// reordering, so they are dropped instead of drawn as missing glyphs.
var FORMATTING_CHARACTER = /^[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]$/;
// The same characters, to remove them from a whole text.
var FORMATTING_CHARACTERS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

// Marks that combine with the character before them, such as Hebrew points.
var COMBINING_MARK = /^\p{M}$/u;
// Variation selectors, which choose the form of the character before them and
// always follow it.
var VARIATION_SELECTOR = /^[\ufe00-\ufe0f\u{e0100}-\u{e01ef}]$/u;

// Characters that need a stand-in before bidi-js classifies the text: it
// reads UTF-16 code units, so it would take each surrogate as a strong
// left-to-right letter, and it would end a paragraph at U+001C-U+001E, which
// Recipe does not break at.
var NEEDS_STAND_IN = /[\ud800-\udfff\u001c-\u001e]/;
// A character of each bidirectional class, to stand in for a character
// bidi-js cannot classify in place. None of them is mirrored.
var CLASS_STAND_IN = {
  L: "a",
  R: "\u05d0",
  AL: "\u0627",
  EN: "0",
  ES: "+",
  ET: "#",
  AN: "\u0660",
  CS: ",",
  NSM: "\u0300",
  BN: "\u200b",
  S: "\t",
  WS: " ",
  ON: "\u2605",
};

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
 * The text bidi-js classifies in place of `text`: the same length, with each
 * character outside the Basic Multilingual Plane replaced by a character of
 * its bidirectional class followed by a non-spacing mark, which takes that
 * class too, and U+001C-U+001E replaced by a neutral character.
 *
 * @param {string} text The text.
 * @returns {string} The text to pass to bidi-js.
 */
function bidiText(text) {
  if (!NEEDS_STAND_IN.test(text)) return text;
  var api = getBidi();
  var result = "";
  for (var index = 0; index < text.length; ++index) {
    var code = text.charCodeAt(index);
    if (code >= 0x1c && code <= 0x1e) {
      result += CLASS_STAND_IN.ON;
    } else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      isLowSurrogateAt(text, index + 1)
    ) {
      var type = api.getBidiCharTypeName(
        String.fromCodePoint(text.codePointAt(index)),
      );
      result += (CLASS_STAND_IN[type] || CLASS_STAND_IN.L) + CLASS_STAND_IN.NSM;
      ++index;
    } else if (code >= 0xd800 && code <= 0xdfff) {
      // A lone surrogate draws as a missing glyph; treat it as neutral.
      result += CLASS_STAND_IN.ON;
    } else {
      result += text[index];
    }
  }
  return result;
}

// The bidirectional classes of strong right-to-left letters, as bidi-js
// names them.
var RIGHT_TO_LEFT_CLASSES = Object.freeze(["R", "AL"]);

/**
 * Whether a character is a strong right-to-left letter, whose marks fonts
 * place before it in a right-to-left run.
 *
 * @param {string} text The text.
 * @param {number} index The UTF-16 index of the character.
 * @returns {boolean} True for a letter of bidirectional class R or AL.
 */
function isRightToLeftLetter(text, index) {
  var type = getBidi().getBidiCharTypeName(
    String.fromCodePoint(text.codePointAt(index)),
  );
  return RIGHT_TO_LEFT_CLASSES.indexOf(type) !== -1;
}

// The bidirectional classes of strong letters, which set the direction of
// the paragraph they start.
var STRONG_CLASSES = Object.freeze(["L", "R", "AL"]);

/**
 * Whether text holds a character that can set its paragraph's direction: a
 * letter of either direction, or a left-to-right or right-to-left mark.
 *
 * @param {string} text The text.
 * @returns {boolean} True for text with a character of class L, R or AL.
 */
function hasStrongCharacter(text) {
  var api = getBidi();
  for (var index = 0; index < text.length; ++index) {
    var type = api.getBidiCharTypeName(
      String.fromCodePoint(text.codePointAt(index)),
    );
    if (STRONG_CLASSES.indexOf(type) !== -1) return true;
    if (isLowSurrogateAt(text, index + 1)) ++index;
  }
  return false;
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
  return getBidi().getEmbeddingLevels(bidiText(text)).paragraphs[0].level % 2
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
  var joined = graphemeContinuations(text);
  // The start of the last cluster that is drawn, if any.
  var base = -1;
  for (var index = 0; index < text.length; ++index) {
    var lowSurrogate = isLowSurrogateAt(text, index);
    if (FORMATTING_CHARACTER.test(text[index])) {
      starts[index] = index;
    } else if (
      base !== -1 &&
      (lowSurrogate ||
        joined[index] ||
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
 * The UTF-16 indices that continue a user-perceived character, such as the
 * parts of an emoji joined with U+200D or a skin tone modifier, so
 * reordering keeps them together. Without `Intl.Segmenter` no index is
 * marked, and only combining marks and surrogate pairs stay together.
 *
 * @param {string} text The text.
 * @returns {boolean[]} True at every index that does not start a character.
 */
function graphemeContinuations(text) {
  var joined = new Array(text.length);
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
    return joined;
  }
  var segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  Array.from(segmenter.segment(text)).forEach(function (segment) {
    for (var offset = 1; offset < segment.segment.length; ++offset) {
      joined[segment.index + offset] = true;
    }
  });
  return joined;
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
 * @returns {{characters: Array<{index: number, character: string}>, rtl:
 * boolean}} Each drawn character with its UTF-16 index in `core`, from left
 * to right, and whether the paragraph is right to left.
 */
function visualCharacters(core, direction) {
  var api = getBidi();
  var classified = bidiText(core);
  var levels = api.getEmbeddingLevels(
    classified,
    direction === TextDirection.AUTO ? undefined : direction,
  );
  var order = api.getReorderedIndices(classified, levels);
  var mirrored = api.getMirroredCharactersMap(classified, levels.levels);
  var starts = clusterStarts(core);
  var members = clusterMembers(starts);
  var written = new Array(core.length);
  var visual = [];
  order.forEach(function (index) {
    var start = starts[index];
    if (written[start]) return;
    written[start] = true;
    var cluster = members[start];
    if (levels.levels[start] % 2 && isRightToLeftLetter(core, start)) {
      // Right-to-left fonts place a mark over the glyph drawn after it, so
      // on a right-to-left letter the marks come first, as the
      // bidirectional algorithm orders them. Surrogate pairs keep their
      // order, and variation selectors stay after the letter.
      var units = [];
      cluster.forEach(function (position) {
        if (isLowSurrogateAt(core, position)) {
          units[units.length - 1].push(position);
        } else units.push([position]);
      });
      var base = units.shift();
      var selectors = units.filter(function (unit) {
        return VARIATION_SELECTOR.test(
          String.fromCodePoint(core.codePointAt(unit[0])),
        );
      });
      cluster = [].concat.apply(
        [],
        units
          .filter(function (unit) {
            return selectors.indexOf(unit) === -1;
          })
          .reverse()
          .concat([base], selectors),
      );
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
  return { characters: visual, rtl: levels.paragraphs[0].level % 2 === 1 };
}

/**
 * Reorder one paragraph to visual order. Whitespace at its end stays at the
 * end of the text; whitespace at its start, such as an indent, stays at the
 * paragraph's start: on the left of a left-to-right paragraph and on the
 * right of a right-to-left one.
 *
 * @param {string} paragraph The paragraph text.
 * @param {string} direction "auto", "ltr" or "rtl".
 * @returns {string} The paragraph in visual order.
 */
function reorderParagraph(paragraph, direction) {
  var edges = /^(\s*)([\s\S]*?)(\s*)$/.exec(paragraph);
  if (!edges[2]) return paragraph;
  var visual = visualCharacters(edges[2], direction);
  var core = visual.characters
    .map(function (entry) {
      return entry.character;
    })
    .join("");
  return visual.rtl ? core + edges[3] + edges[1] : edges[1] + core + edges[3];
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
 * characters are dropped. Whitespace at the end of the text stays at the end,
 * and whitespace at its start, such as an indent, stays at the paragraph's
 * start: the left for a left-to-right paragraph and the right for a
 * right-to-left one, after any trailing whitespace. Text holding
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
      return index % 2 ? part : reorderParagraph(part, direction);
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
 * order, a segment ends with the space that follows its word, and no segment
 * is only whitespace. Whitespace at the start of the line, such as a list
 * indent, becomes `indent` segments at the line's start: first in a
 * left-to-right line and last in a right-to-left one, as in `toVisual()`.
 *
 * @param {string[]} texts The runs of the line in logical order.
 * @param {string} [direction] A `TextDirection` value; defaults to "none".
 * "auto" takes the direction of the line's first strong letter.
 * @returns {Array<{run: number, text: string, indent: (boolean|undefined)}>|null}
 * The segments, with the index of the run each one belongs to, or null when
 * the line keeps its logical order: for "none", for left-to-right text, for
 * a line of only whitespace and formatting characters, and for a line
 * holding a paragraph break.
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
  if (!edges[2]) return null;
  var leading = edges[1].length;
  var visual = visualCharacters(edges[2], direction);
  var characters = visual.characters.map(function (entry) {
    return { index: entry.index + leading, character: entry.character };
  });
  var index;
  for (index = leading + edges[2].length; index < line.length; ++index) {
    characters.push({ index: index, character: line[index] });
  }
  /**
   * Group characters into segments of consecutive characters of one run.
   *
   * @param {Array<{index: number, character: string}>} entries Characters.
   * @param {boolean} indent Whether the segments are the line's indent.
   * @returns {Array<{run: number, text: string}>} The segments.
   */
  function group(entries, indent) {
    var groups = [];
    entries.forEach(function (entry) {
      var run = owners[entry.index];
      var last = groups[groups.length - 1];
      if (last && last.run === run) last.text += entry.character;
      else {
        groups.push(
          indent
            ? { run: run, text: entry.character, indent: true }
            : { run: run, text: entry.character },
        );
      }
    });
    return groups;
  }
  var segments = group(characters, false);
  for (index = 1; index < segments.length; ++index) {
    var space = BREAKABLE_SPACE.exec(segments[index].text);
    if (space) {
      segments[index - 1].text += space[0];
      segments[index].text = segments[index].text.slice(space[0].length);
    }
  }
  // Moving spaces can leave a segment with only whitespace, such as the
  // space between two words of other runs; it joins the segment before it.
  segments = segments.reduce(function (kept, segment) {
    if (segment.text === "") return kept;
    if (kept.length && segment.text.trim() === "") {
      kept[kept.length - 1].text += segment.text;
    } else kept.push(segment);
    return kept;
  }, []);
  var indent = [];
  for (index = 0; index < leading; ++index) {
    indent.push({ index: index, character: line[index] });
  }
  indent = group(indent, true);
  // A line of nothing but formatting characters and whitespace keeps its
  // order.
  if (
    !segments.some(function (segment) {
      return segment.text.trim() !== "";
    })
  ) {
    return null;
  }
  return visual.rtl ? segments.concat(indent) : indent.concat(segments);
}

/**
 * Split visual segments into words, each ending with the breakable
 * whitespace that follows it, so justification can widen the gaps between
 * words. Non-breaking spaces stay inside their word.
 *
 * @param {Array<{run: number, text: string}>} segments Segments from
 * `visualRuns()`.
 * @returns {Array<{run: number, text: string, gap: boolean, indent:
 * (boolean|undefined)}>} The words from left to right; `gap` marks a visible
 * word followed by breakable whitespace and more text, whose gap
 * justification may widen, and `indent` keeps an indent segment whole.
 */
function visualWords(segments) {
  var words = [];
  segments.forEach(function (segment) {
    if (segment.indent) {
      words.push({
        run: segment.run,
        text: segment.text,
        gap: false,
        indent: true,
      });
      return;
    }
    var pattern =
      /(?:(?![\u00a0\u2007\u202f])\s)*(?:[^\s]|[\u00a0\u2007\u202f])+(?:(?![\u00a0\u2007\u202f])\s)*|\s+/g;
    var match;
    while ((match = pattern.exec(segment.text))) {
      words.push({ run: segment.run, text: match[0], gap: false });
    }
  });
  // From the right, so each word knows whether visible text follows it.
  var textFollows = false;
  for (var index = words.length - 1; index >= 0; --index) {
    var visible = words[index].text.trim() !== "";
    words[index].gap =
      visible &&
      textFollows &&
      TRAILING_BREAKABLE_SPACE.test(words[index].text);
    textFollows = textFollows || visible;
  }
  return words;
}

export {
  TextDirection,
  readDirection,
  hasReorderingCharacters,
  hasStrongCharacter,
  resolveDirection,
  paragraphDirections,
  toVisual,
  drawnText,
  visualRuns,
  visualWords,
};
