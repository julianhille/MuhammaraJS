// Reorders right-to-left text, such as Hebrew, from the order it is typed in
// to the left-to-right order PDF draws glyphs in. Mirrored in
// packages/wasm/lib/text-direction.js; keep both files identical apart from
// the module syntax.

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
var HAS_COMBINING_MARK = /\p{M}/u;
// Marks a font draws over a letter, without an advance of their own.
var NONSPACING_MARK = /^[\p{Mn}\p{Me}]$/u;
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
// Whitespace a line may break at, ending a text; non-breaking spaces belong
// to their word.
var TRAILING_BREAKABLE_SPACE = /(?:(?![\u00a0\u2007\u202f])\s)+$/;

// Isolates that place a run with a direction of its own in a line, and the
// modes of a run in a line besides "ltr" and "rtl".
var ISOLATE_LTR = "\u2066";
var ISOLATE_RTL = "\u2067";
var POP_ISOLATE = "\u2069";
var RUN_FOLLOWS = "follows";
var RUN_KEPT = "kept";

// The bidi-js factory, or the error that kept it from loading. The package
// entry point loads bidi-js and hands it over with useBidi().
var bidiFactory = null;
var bidi = null;
// The grapheme segmenter, created on first use; false without
// Intl.Segmenter.
var graphemeSegmenter = null;

/**
 * The bidi-js instance, created on first use.
 *
 * @returns {object} The bidi-js API.
 */
function getBidi() {
  if (!bidi) {
    if (typeof bidiFactory !== "function") {
      throw new Error("Reordering right-to-left text needs bidi-js", {
        cause: bidiFactory || undefined,
      });
    }
    bidi = bidiFactory();
  }
  return bidi;
}

/**
 * Sets the bidi-js factory text is reordered with. A failed load passes its
 * error instead, which reordering then throws as its cause; text drawn with
 * direction "none" never needs bidi-js.
 *
 * @param {Function|Error} factory The bidi-js default export, or the error
 *   loading it threw.
 */
function useBidi(factory) {
  bidiFactory = factory;
  bidi = null;
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
 * letter of either direction, or a left-to-right or right-to-left mark,
 * outside any isolate, which the paragraph's direction skips.
 *
 * @param {string} text The text.
 * @returns {boolean} True for text with a character of class L, R or AL
 * outside an isolate.
 */
function hasStrongCharacter(text) {
  var api = getBidi();
  var isolates = 0;
  for (var index = 0; index < text.length; ++index) {
    var code = text.charCodeAt(index);
    if (code >= 0x2066 && code <= 0x2068) {
      ++isolates;
      continue;
    }
    if (code === 0x2069) {
      if (isolates) --isolates;
      continue;
    }
    if (!isolates) {
      var type = api.getBidiCharTypeName(
        String.fromCodePoint(text.codePointAt(index)),
      );
      if (STRONG_CLASSES.indexOf(type) !== -1) return true;
    }
    if (isLowSurrogateAt(text, index + 1)) ++index;
  }
  return false;
}

/**
 * Split text into paragraphs at the mandatory breaks Recipe wraps at, the
 * same breaks that end a paragraph's direction.
 *
 * @param {string} text The text.
 * @returns {string[]} The paragraphs, without their breaks.
 */
function splitParagraphs(text) {
  return text.split(PARAGRAPH_BREAK);
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
  // The paragraphs are sorted by their end, so a line of a long text finds
  // its own without walking every paragraph before it.
  return function (offset) {
    var low = 0;
    var high = paragraphs.length - 1;
    while (low < high) {
      var middle = (low + high) >> 1;
      if (offset < paragraphs[middle].end) high = middle;
      else low = middle + 1;
    }
    return paragraphs[low].direction;
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
  if (graphemeSegmenter === null) {
    graphemeSegmenter =
      typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
        ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
        : false;
  }
  if (!graphemeSegmenter) return joined;
  Array.from(graphemeSegmenter.segment(text)).forEach(function (segment) {
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
 * @param {boolean[]} [opaque] True at every UTF-16 index of `core` that is
 * kept as given: classified as a left-to-right letter, so it keeps its order
 * inside the isolate around it, never mirrored, and drawn even when it is a
 * formatting character.
 * @returns {{characters: Array<{index: number, character: string}>, rtl:
 * boolean}} Each drawn character with its UTF-16 index in `core`, from left
 * to right, and whether the paragraph is right to left.
 */
function visualCharacters(core, direction, opaque) {
  var api = getBidi();
  var classified = bidiText(core);
  if (opaque) {
    classified = classified
      .split("")
      .map(function (character, index) {
        return opaque[index] ? CLASS_STAND_IN.L : character;
      })
      .join("");
  }
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
    if (
      !(opaque && opaque[start]) &&
      levels.levels[start] % 2 &&
      isRightToLeftLetter(core, start)
    ) {
      cluster = marksFirst(core, cluster);
    }
    cluster.forEach(function (position) {
      var character = core[position];
      if (opaque && opaque[position]) {
        visual.push({ index: position, character: character });
      } else if (!FORMATTING_CHARACTER.test(character)) {
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
 * Order the positions of a cluster on a right-to-left letter as they are
 * drawn. Right-to-left fonts place a mark over the glyph drawn after it, so
 * the marks come first, as the bidirectional algorithm orders them.
 * Surrogate pairs keep their order, and variation selectors stay after the
 * letter.
 *
 * @param {string} text The text.
 * @param {number[]} cluster The UTF-16 positions of the cluster, its letter
 *   first.
 * @returns {number[]} The positions in the order they are drawn.
 */
function marksFirst(text, cluster) {
  var units = [];
  cluster.forEach(function (position) {
    if (isLowSurrogateAt(text, position)) {
      units[units.length - 1].push(position);
    } else units.push([position]);
  });
  var base = units.shift();
  var selectors = units.filter(function (unit) {
    return VARIATION_SELECTOR.test(
      String.fromCodePoint(text.codePointAt(unit[0])),
    );
  });
  return [].concat.apply(
    [],
    units
      .filter(function (unit) {
        return selectors.indexOf(unit) === -1;
      })
      .reverse()
      .concat([base], selectors),
  );
}

/**
 * The characters `toVisual()` draws, still in logical order: the text without
 * its formatting characters, with the marks on each right-to-left letter
 * before it, or unchanged for "none". Measure this text, not the original,
 * so a measured width matches the drawn one: a mark drawn after its letter
 * reaches past it.
 *
 * @param {string} text The text.
 * @param {string} [direction] A `TextDirection` value; defaults to "none".
 * @returns {string} The text to measure.
 * @throws {TypeError} If `direction` is not a `TextDirection` value.
 */
function drawnText(text, direction) {
  direction = readDirection(direction);
  if (!reorders(text, direction)) return text;
  var core = text.replace(FORMATTING_CHARACTERS, "");
  if (!HAS_COMBINING_MARK.test(core)) return core;
  var starts = clusterStarts(core);
  var members = clusterMembers(starts);
  var drawn = "";
  starts.forEach(function (start, index) {
    if (start !== index) return;
    var cluster = members[start];
    if (cluster.length > 1 && isRightToLeftLetter(core, start)) {
      cluster = marksFirst(core, cluster);
    }
    cluster.forEach(function (position) {
      drawn += core[position];
    });
  });
  return drawn;
}

/**
 * Whether a character is drawn after its marks: one of a right-to-left class,
 * as reordering tells them apart. A character that cannot reorder text is
 * left to right without asking bidi-js, so text drawn without it never
 * needs it here; right-to-left text was reordered with it.
 *
 * @param {string} character One character.
 * @returns {boolean} Whether the marks of the character come before it.
 */
function drawnAfterItsMarks(character) {
  return (
    hasReorderingCharacters(character) && isRightToLeftLetter(character, 0)
  );
}

/**
 * Split text, in the order it is drawn, where character spacing must not go:
 * between a mark and the character it belongs to, so the mark stays over it.
 * Reordering draws the marks of a right-to-left letter before it and those
 * of any other character after it; marks drawn between two characters go
 * with the one after them when that is a right-to-left letter. Text drawn as
 * given, with direction "none", keeps spacing everywhere. Spacing goes
 * between the characters of each piece only.
 *
 * Whichever character marks between two others belong to, they take one
 * boundary out of the spacing each, so a text takes spacing at one boundary
 * fewer than it has characters other than marks, in the order it is typed
 * and in the order it is drawn.
 *
 * @param {string} text The text in the order it is drawn.
 * @param {string} [direction] The `TextDirection` value it was drawn with;
 *   defaults to "none".
 * @returns {string[]} The pieces; one piece when spacing goes everywhere.
 */
function spacedPieces(text, direction) {
  if (
    readDirection(direction) === TextDirection.NONE ||
    !HAS_COMBINING_MARK.test(text)
  ) {
    return [text];
  }
  var characters = Array.from(text);
  // Whether no spacing goes between a character and the one before it.
  var joined = new Array(characters.length).fill(false);
  var index = 0;
  while (index < characters.length) {
    if (!NONSPACING_MARK.test(characters[index])) {
      ++index;
      continue;
    }
    var end = index;
    while (end < characters.length && NONSPACING_MARK.test(characters[end])) {
      joined[end] = end > index;
      ++end;
    }
    if (
      end < characters.length &&
      (index === 0 || drawnAfterItsMarks(characters[end]))
    ) {
      joined[end] = true;
    } else if (index > 0) joined[index] = true;
    index = end;
  }
  var pieces = [""];
  characters.forEach(function (character, index) {
    if (joined[index]) pieces.push("");
    pieces[pieces.length - 1] += character;
  });
  return pieces;
}

/**
 * The number of character boundaries that character spacing widens in text
 * drawn as it is, as `spacedPieces()` splits it: for the pieces of a line
 * that are already in visual order.
 *
 * @param {string} text The text in the order it is drawn.
 * @param {string} [direction] The `TextDirection` value it was drawn with;
 *   defaults to "none".
 * @returns {number} The number of spaced boundaries.
 */
function drawnGaps(text, direction) {
  return spacedPieces(text, direction).reduce(function (gaps, piece) {
    var length = Array.from(piece).length;
    return gaps + (length ? length - 1 : 0);
  }, 0);
}

/**
 * The number of character boundaries that character spacing widens once
 * text is drawn, counted in the order it is typed: every boundary for text
 * drawn as given, with direction "none"; otherwise one fewer than the
 * characters other than marks, as marks take no spacing on their character
 * and formatting characters reordering drops take none. The count does not
 * depend on the order the text is drawn in, so it is the same as
 * `drawnGaps()` of the drawn text.
 *
 * @param {string} text The text in the order it is typed.
 * @param {string} [direction] The `TextDirection` value it is drawn with;
 *   defaults to "none".
 * @returns {number} The number of spaced boundaries.
 */
function spacedGaps(text, direction) {
  text = String(text);
  if (readDirection(direction) === TextDirection.NONE) {
    return Math.max(Array.from(text).length - 1, 0);
  }
  var characters = Array.from(text.replace(FORMATTING_CHARACTERS, ""));
  var spaced = characters.filter(function (character) {
    return !NONSPACING_MARK.test(character);
  }).length;
  return Math.max(spaced - 1, 0);
}

/**
 * The advance one space takes when drawn. Measured text bounds leave out
 * the whitespace at their ends, so it is where "o o" ends less where "oo"
 * ends.
 *
 * @param {function(string): number} glyphsEnd Where the glyphs of a text
 *   end, in points, in the font and size to measure.
 * @returns {number} The advance in points.
 */
function spaceAdvance(glyphsEnd) {
  return glyphsEnd("o o") - glyphsEnd("oo");
}

/**
 * Reorder a line made of several runs, such as the styled runs of HTML text,
 * as one line. Each returned segment is a piece of one run, already in visual
 * order, and the segments are listed from left to right. Every character,
 * whitespace included, stays in a segment of its own run, so a run of only
 * whitespace is a segment of its own. Whitespace at the start of the line,
 * such as a list indent, becomes `indent` segments at the line's start: first
 * in a left-to-right line and last in a right-to-left one, as in
 * `toVisual()`.
 *
 * A run can keep a direction of its own, given in `runDirections`. A run
 * whose own direction is the line's, "auto", or not given follows the line.
 * Any other run is a block placed in the line like one word, as a Unicode
 * isolate: an "ltr" or "rtl" run is reordered on its own in that direction,
 * and a "none" run is kept exactly as given. In a "none" line, every run
 * that follows the line is kept as given too.
 *
 * @param {string[]} texts The runs of the line in logical order.
 * @param {string} [direction] A `TextDirection` value; defaults to "none".
 * "auto" takes the direction of the line's first strong letter.
 * @param {Array<(string|undefined)>} [runDirections] The direction each run
 * asked for, a `TextDirection` value or undefined to follow the line.
 * @returns {Array<{run: number, text: string, indent: (boolean|undefined)}>|null}
 * The segments, with the index of the run each one belongs to, or null when
 * the line keeps its logical order: for "none", for left-to-right text, for
 * a line of only whitespace and formatting characters, and for a line
 * holding a paragraph break.
 * @throws {TypeError} If `direction` or a run direction is not a
 * `TextDirection` value.
 */
function visualRuns(texts, direction, runDirections) {
  direction = readDirection(direction);
  var modes = texts.map(function (text, run) {
    var own = runDirections ? runDirections[run] : undefined;
    if (own === undefined || own === null) own = TextDirection.AUTO;
    own = readDirection(own);
    if (own === TextDirection.NONE) return RUN_KEPT;
    if (own === TextDirection.AUTO || own === direction) {
      return direction === TextDirection.NONE ? RUN_KEPT : RUN_FOLLOWS;
    }
    return own;
  });
  var isolated = modes.some(function (mode) {
    return mode !== RUN_FOLLOWS;
  });
  var joined = texts.join("");
  PARAGRAPH_BREAK.lastIndex = 0;
  if (PARAGRAPH_BREAK.test(joined)) return null;
  if (!isolated && !reorders(joined, direction)) return null;
  if (
    modes.every(function (mode) {
      return mode === RUN_KEPT;
    })
  ) {
    return null;
  }
  // A run with a direction of its own is wrapped in an isolate.
  var line = "";
  var owners = [];
  var opaque = [];
  texts.forEach(function (text, run) {
    var mode = modes[run];
    var open =
      mode === TextDirection.RTL
        ? ISOLATE_RTL
        : mode === RUN_FOLLOWS
          ? ""
          : ISOLATE_LTR;
    var close = open ? POP_ISOLATE : "";
    var piece = open + text + close;
    for (var index = 0; index < piece.length; ++index) {
      owners.push(run);
      opaque.push(
        mode === RUN_KEPT && index >= open.length && index < piece.length - 1,
      );
    }
    line += piece;
  });
  var edges = /^(\s*)([\s\S]*?)(\s*)$/.exec(line);
  if (!edges[2]) return null;
  var leading = edges[1].length;
  var visual = visualCharacters(
    edges[2],
    direction === TextDirection.NONE ? TextDirection.LTR : direction,
    isolated ? opaque.slice(leading, leading + edges[2].length) : undefined,
  );
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
  // Every character stays in its own run's segment, spaces included, so it
  // is drawn and measured with its run's font, size, hilite and lines.
  var segments = group(characters, false);
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
  var ordered = visual.rtl ? segments.concat(indent) : indent.concat(segments);
  // A line whose runs all stay as they are keeps its logical order.
  if (
    isolated &&
    ordered
      .map(function (segment) {
        return segment.text;
      })
      .join("") === joined
  ) {
    return null;
  }
  return ordered;
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
    // Whitespace that starts a segment, or makes up all of it, is a word of
    // its own: it belongs to its run, not to the word before it.
    var pattern =
      /(?:[^\s]|[\u00a0\u2007\u202f])+(?:(?![\u00a0\u2007\u202f])\s)*|(?:(?![\u00a0\u2007\u202f])\s)+/g;
    var match;
    while ((match = pattern.exec(segment.text))) {
      words.push({ run: segment.run, text: match[0], gap: false });
    }
  });
  // A gap is breakable whitespace between visible text: that ending a word,
  // or a word of only whitespace. From the right, so each word knows
  // whether visible text follows it.
  var seen = false;
  var textBefore = words.map(function (word) {
    var before = seen;
    seen = seen || word.text.trim() !== "";
    return before;
  });
  var textFollows = false;
  for (var index = words.length - 1; index >= 0; --index) {
    var visible = words[index].text.trim() !== "";
    words[index].gap =
      !words[index].indent &&
      textFollows &&
      (visible || textBefore[index]) &&
      TRAILING_BREAKABLE_SPACE.test(words[index].text);
    textFollows = textFollows || visible;
  }
  return words;
}

module.exports = {
  TextDirection: TextDirection,
  readDirection: readDirection,
  hasReorderingCharacters: hasReorderingCharacters,
  hasStrongCharacter: hasStrongCharacter,
  resolveDirection: resolveDirection,
  paragraphDirections: paragraphDirections,
  splitParagraphs: splitParagraphs,
  toVisual: toVisual,
  drawnText: drawnText,
  visualRuns: visualRuns,
  visualWords: visualWords,
  spacedPieces: spacedPieces,
  spacedGaps: spacedGaps,
  spaceAdvance: spaceAdvance,
  drawnGaps: drawnGaps,
  useBidi: useBidi,
};
