// Reorders right-to-left text, such as Hebrew, from the order it is typed in
// to the left-to-right order PDF draws glyphs in. Mirrored in
// packages/native-core/lib/text-direction.js; keep both files identical apart
// from the module syntax.

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

// The no-break spaces a line keeps where it would drop the spaces it breaks
// at, and the mandatory breaks that end a line and its paragraph: the bodies
// of the character classes both ends build their text patterns from.
var NO_BREAK_SPACES = "\\u00a0\\u2007\\u202f";
var LINE_BREAKS = "\\n\\v\\f\\r\\u0085\\u2028\\u2029";
// A space a line may break at: whitespace but a no-break space.
var BREAKABLE_SPACE = "(?:(?![" + NO_BREAK_SPACES + "])\\s)";
// A word with the spaces a line may break at after it; no-break spaces
// belong to their word.
var WORD = "(?:\\S|[" + NO_BREAK_SPACES + "])+" + BREAKABLE_SPACE + "*";
// The spaces that end a text and that a line drops, a next line (U+0085)
// included.
var TRAILING_BREAKABLE_SPACES = new RegExp(
  "(?:(?![" + NO_BREAK_SPACES + "])[\\s\\u0085])+$",
);

// The whitespace at a line's start and end, kept at the paragraph's start
// and the text's end, where a line breaks: not the no-break spaces, which a
// line keeps, or U+FEFF. They are placed as the bidirectional algorithm
// places them, so a no-break space ending a right-to-left line is drawn on
// its left.
var EDGE_SPACE = new RegExp("^(?![" + NO_BREAK_SPACES + "\\ufeff])\\s$");

/**
 * Split a line into the whitespace at its start, the text between and the
 * whitespace at its end, in time linear in its length.
 *
 * @param {string} line The line.
 * @returns {string[]} The whitespace at its start, the text between, empty
 *   for a line of only whitespace, and the whitespace at its end.
 */
function lineEdges(line) {
  var start = 0;
  while (start < line.length && EDGE_SPACE.test(line[start])) ++start;
  var end = line.length;
  while (end > start && EDGE_SPACE.test(line[end - 1])) --end;
  return [line.slice(0, start), line.slice(start, end), line.slice(end)];
}

// A surrogate pair, or a lone surrogate, which reordering could join into
// a pair with another one; it is drawn as U+FFFD, as without reordering.
var SURROGATES = /([\ud800-\udbff][\udc00-\udfff])|[\ud800-\udfff]/g;

/**
 * Replace the lone surrogates of a text with U+FFFD.
 *
 * @param {string} text The text.
 * @returns {string} The text with every surrogate in a pair.
 */
function wellFormed(text) {
  return text.replace(SURROGATES, function (match, pair) {
    return pair || "\ufffd";
  });
}

// Invisible bidirectional formatting characters. They only steer the
// reordering, so they are dropped instead of drawn as missing glyphs.
var FORMATTING_CHARACTER = /^[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]$/;
// The formatting characters that start or end a run of their own: the
// isolates and embeddings, not the direction marks.
var RUN_BOUNDARY = /^[\u202a-\u202e\u2066-\u2069]$/;
// The same characters, to remove them from a whole text.
var FORMATTING_CHARACTERS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

// Marks that combine with the character before them, such as Hebrew points.
var COMBINING_MARK = /^\p{M}$/u;
var HAS_COMBINING_MARK = /\p{M}/u;
// What can continue a letter's cluster: a mark or a joiner.
var HAS_CLUSTER_CONTINUATION = /[\p{M}\u200c\u200d]/u;
// Marks a font draws over a letter, without an advance of their own.
var NONSPACING_MARK = /^[\p{Mn}\p{Me}]$/u;
// A letter or digit of any script, which marks can follow.
var LETTER = /^[\p{L}\p{N}]$/u;
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
var PARAGRAPH_BREAK = new RegExp("\\r\\n|[" + LINE_BREAKS + "]", "g");
// The same breaks, captured, to split text into paragraphs and breaks.
var PARAGRAPH_SPLIT = new RegExp("(\\r\\n|[" + LINE_BREAKS + "])");
// Whitespace a line may break at, ending a text; non-breaking spaces belong
// to their word.
var TRAILING_BREAKABLE_SPACE = new RegExp(BREAKABLE_SPACE + "+$");

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
// The UTF-16 length a text is first segmented in.
var SEGMENT_CHUNK = 1024;

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
 * Whether bidi-js is loaded, so text can be reordered.
 *
 * @returns {boolean} True once a bidi-js factory is set.
 */
function hasBidi() {
  return typeof bidiFactory === "function";
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

// The bidirectional classes this module tells apart, as bidi-js names them.
var BIDI_CLASS = Object.freeze({
  // A strong left-to-right letter.
  L: "L",
  // A strong right-to-left letter.
  R: "R",
  // A strong right-to-left Arabic letter.
  AL: "AL",
  // A paragraph separator.
  B: "B",
});

// The bidirectional classes of strong right-to-left letters.
var RIGHT_TO_LEFT_CLASSES = Object.freeze([BIDI_CLASS.R, BIDI_CLASS.AL]);

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

/**
 * The direction of the first character that can set a paragraph's
 * direction: a letter of either direction, or a left-to-right or
 * right-to-left mark, outside any isolate, which the paragraph's direction
 * skips. This is the direction the bidirectional algorithm gives the
 * paragraph, found without running it on the whole text.
 *
 * @param {string} text The text.
 * @param {boolean} [paragraph=false] Whether to stop at the first
 *   paragraph separator, as the paragraph's direction does.
 * @returns {string|null} "ltr" or "rtl", or null without such a character.
 */
function firstStrongDirection(text, paragraph) {
  // bidi-js is loaded only for text beyond ASCII, so plain left-to-right text
  // needs none.
  var api = null;
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
    var pair =
      code >= 0xd800 && code <= 0xdbff && isLowSurrogateAt(text, index + 1);
    // U+001C-U+001E do not end a paragraph here, and a lone surrogate is
    // neutral, as bidiText() classifies them.
    var neutral =
      (code >= 0x1c && code <= 0x1e) ||
      (code >= 0xd800 && code <= 0xdfff && !pair);
    if (!neutral) {
      var type;
      if (code < 0x80) {
        // ASCII's classes: letters are L, LF and CR end a paragraph, and the
        // rest sets no direction.
        type = /[A-Za-z]/.test(text[index])
          ? BIDI_CLASS.L
          : code === 0x0a || code === 0x0d
            ? BIDI_CLASS.B
            : null;
      } else {
        api = api || getBidi();
        type = api.getBidiCharTypeName(
          String.fromCodePoint(text.codePointAt(index)),
        );
      }
      if (type === BIDI_CLASS.B && paragraph) return null;
      if (!isolates) {
        if (type === BIDI_CLASS.L) return TextDirection.LTR;
        if (RIGHT_TO_LEFT_CLASSES.indexOf(type) !== -1) {
          return TextDirection.RTL;
        }
      }
    }
    if (pair) ++index;
  }
  return null;
}

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
  return firstStrongDirection(text) !== null;
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
  return firstStrongDirection(text, true) || TextDirection.LTR;
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
    /**
     * The direction of every paragraph, one for all of them.
     *
     * @returns {string} The resolved direction.
     */
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
  /**
   * The direction of the paragraph holding a UTF-16 offset.
   *
   * @param {number} offset The offset.
   * @returns {string} The paragraph's resolved direction.
   */
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
 * characters are dropped when drawn, so a mark after a direction mark joins
 * the character before that mark; an isolate or embedding starts or ends a
 * run of its own, so a mark after one starts a cluster of its own.
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
      if (RUN_BOUNDARY.test(text[index])) base = -1;
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
  // Segmenting a long text in one go takes memory quadratic in its length on
  // some Node versions, so it is segmented in chunks. A chunk ends where its
  // last segment starts, as that segment may go on in the next chunk; a
  // segment longer than a chunk makes the chunk longer.
  var start = 0;
  var size = SEGMENT_CHUNK;
  while (start < text.length) {
    var end = Math.min(start + size, text.length);
    // Not between the halves of a surrogate pair, which would be a cluster
    // of its own.
    if (isLowSurrogateAt(text, end)) ++end;
    var last = end >= text.length;
    var segments = Array.from(
      graphemeSegmenter.segment(text.slice(start, end)),
    );
    if (!last && segments.length < 2) {
      size *= 2;
      continue;
    }
    var kept = last ? segments : segments.slice(0, -1);
    kept.forEach(function (segment) {
      for (var offset = 1; offset < segment.segment.length; ++offset) {
        joined[start + segment.index + offset] = true;
      }
    });
    start += last ? end - start : segments[segments.length - 1].index;
    size = SEGMENT_CHUNK;
  }
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
 * @param {{text: string, offset: number}} [context] The paragraph it is one
 * line of, with `core` at `offset` in `text`: the levels are resolved across
 * the paragraph, as the bidirectional algorithm does, and only the line is
 * reordered.
 * @returns {{characters: Array<{index: number, character: string}>, rtl:
 * boolean}} Each drawn character with its UTF-16 index in `core`, from left
 * to right, and whether the paragraph is right to left.
 */
function visualCharacters(core, direction, opaque, context) {
  var api = getBidi();
  var offset = context ? context.offset : 0;
  var resolved = paragraphLevels(context ? context.text : core, direction);
  var classified = resolved.classified;
  var levels = resolved.levels;
  if (opaque) {
    classified =
      classified.slice(0, offset) +
      classified
        .slice(offset, offset + core.length)
        .split("")
        .map(function (character, index) {
          return opaque[index] ? CLASS_STAND_IN.L : character;
        })
        .join("") +
      classified.slice(offset + core.length);
    levels = api.getEmbeddingLevels(
      classified,
      direction === TextDirection.AUTO ? undefined : direction,
    );
  }
  var last = offset + core.length - 1;
  // The line's positions, each run of a level reversed as the algorithm
  // reverses them, in the line only.
  var order = [];
  for (var position = offset; position <= last; ++position) {
    order.push(position);
  }
  api
    .getReorderSegments(classified, levels, offset, last)
    .forEach(function (segment) {
      var low = segment[0] - offset;
      var high = segment[1] - offset;
      for (; low < high; ++low, --high) {
        var swapped = order[low];
        order[low] = order[high];
        order[high] = swapped;
      }
    });
  var mirrored = api.getMirroredCharactersMap(
    classified,
    levels.levels,
    offset,
    last,
  );
  var starts = clusterStarts(core);
  var members = clusterMembers(starts);
  var visual = [];
  // A cluster is drawn where its first character is, even when a mark of it
  // has another level, such as a mark after a direction mark or a tab.
  order.forEach(function (index) {
    var start = index - offset;
    if (starts[start] !== start) return;
    var cluster = members[start];
    if (
      !(opaque && opaque[start]) &&
      levels.levels[index] % 2 &&
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
          character: mirrored.get(position + offset) || character,
        });
      }
    });
  });
  return { characters: visual, rtl: levels.paragraphs[0].level % 2 === 1 };
}

// The paragraph last resolved, which the next line of it uses again, with the
// bidi-js instance that resolved it.
var lastParagraph = { api: null, text: null, direction: null };

/**
 * A paragraph as bidi-js reads it and its embedding levels, resolved once for
 * all its lines.
 *
 * @param {string} text The paragraph.
 * @param {string} direction "auto", "ltr" or "rtl".
 * @returns {{classified: string, levels: Object}} The text bidi-js reads and
 *   its bidi-js embedding levels.
 */
function paragraphLevels(text, direction) {
  var api = getBidi();
  if (
    lastParagraph.api !== api ||
    lastParagraph.text !== text ||
    lastParagraph.direction !== direction
  ) {
    var classified = bidiText(text);
    lastParagraph = {
      api: api,
      text: text,
      direction: direction,
      classified: classified,
      levels: api.getEmbeddingLevels(
        classified,
        direction === TextDirection.AUTO ? undefined : direction,
      ),
    };
  }
  return lastParagraph;
}

// The paragraph last checked for right-to-left text, which the next line of
// it asks about again.
var lastReordering = { text: null, value: false };

/**
 * Whether a paragraph holds characters that can change its drawing order,
 * checked once for all its lines.
 *
 * @param {string} text The paragraph.
 * @returns {boolean} True for text with right-to-left or formatting characters.
 */
function paragraphReorders(text) {
  if (lastReordering.text !== text) {
    lastReordering = { text: text, value: hasReorderingCharacters(text) };
  }
  return lastReordering.value;
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
  var edges = lineEdges(wellFormed(paragraph));
  if (!edges[1]) return paragraph;
  var visual = visualCharacters(edges[1], direction);
  var core = visual.characters
    .map(function (entry) {
      return entry.character;
    })
    .join("");
  return visual.rtl ? core + edges[2] + edges[0] : edges[0] + core + edges[2];
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
  var marks = [];
  var selectors = [];
  units.forEach(function (unit) {
    var selector = VARIATION_SELECTOR.test(
      String.fromCodePoint(text.codePointAt(unit[0])),
    );
    (selector ? selectors : marks).push(unit);
  });
  // Loops rather than spreading, so a cluster of any number of marks fits.
  var order = [];
  for (var index = marks.length - 1; index >= 0; --index) {
    marks[index].forEach(function (position) {
      order.push(position);
    });
  }
  [base].concat(selectors).forEach(function (unit) {
    unit.forEach(function (position) {
      order.push(position);
    });
  });
  return order;
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
  if (!HAS_CLUSTER_CONTINUATION.test(text)) {
    return text.replace(FORMATTING_CHARACTERS, "");
  }
  // Clusters are found with the formatting characters in place, as
  // reordering finds them: a mark after an isolate is not its letter's.
  var starts = clusterStarts(text);
  var members = clusterMembers(starts);
  var drawn = "";
  starts.forEach(function (start, index) {
    if (start !== index) return;
    var cluster = members[start];
    if (cluster.length > 1 && isRightToLeftLetter(text, start)) {
      cluster = marksFirst(text, cluster);
    }
    cluster.forEach(function (position) {
      if (!FORMATTING_CHARACTER.test(text[position])) drawn += text[position];
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
 * with the one after them when that is a right-to-left letter, unless they
 * follow a left-to-right letter or digit and are not right-to-left marks.
 * Text drawn as given, with direction "none", keeps spacing everywhere.
 * Spacing goes between the characters of each piece only.
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
    // Marks before a right-to-left letter are its own, unless they follow a
    // left-to-right letter or digit and are not right-to-left marks: that
    // character's marks are drawn after it.
    if (
      end < characters.length &&
      (index === 0 ||
        (drawnAfterItsMarks(characters[end]) &&
          !(
            LETTER.test(characters[index - 1]) &&
            !drawnAfterItsMarks(characters[index - 1]) &&
            !hasReorderingCharacters(characters.slice(index, end).join(""))
          )))
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
  return Math.max(spacedCharacters(text, direction) - 1, 0);
}

/**
 * The number of characters character spacing goes between, as
 * `spacedGaps()` counts them: every character for text drawn as given, with
 * direction "none", and otherwise the characters other than marks and the
 * formatting characters reordering drops. Texts drawn one after another
 * take spacing between the sum of theirs.
 *
 * @param {string} text The text in the order it is typed.
 * @param {string} [direction] The `TextDirection` value it is drawn with;
 *   defaults to "none".
 * @returns {number} The number of spaced characters.
 */
function spacedCharacters(text, direction) {
  text = String(text);
  if (readDirection(direction) === TextDirection.NONE) {
    return Array.from(text).length;
  }
  return Array.from(text.replace(FORMATTING_CHARACTERS, "")).filter(
    function (character) {
      return !NONSPACING_MARK.test(character);
    },
  ).length;
}

/**
 * The advance whitespace takes when drawn. Measured text bounds leave out
 * the whitespace at their ends, so it is where "o", the whitespace and "o"
 * end less where "oo" ends.
 *
 * @param {function(string): number} glyphsEnd Where the glyphs of a text
 *   end, in points, in the font and size to measure.
 * @param {string} [whitespace=" "] The whitespace; one space by default.
 * @returns {number} The advance in points.
 */
function spaceAdvance(glyphsEnd, whitespace) {
  return glyphsEnd("o" + (whitespace || " ") + "o") - glyphsEnd("oo");
}

/**
 * Where the glyph after a piece of a reordered line starts: the advance of
 * the piece's glyphs, with the last one's side bearing and spacing, as a
 * glyph after it in the same run would leave them, and never back past the
 * piece's start. Measuring stops at a NUL, so text with one ends at its
 * glyphs.
 *
 * @param {function(string): number} glyphsEnd Where the glyphs of a text
 *   end, in points, in the order it is drawn.
 * @param {string} text The piece without its trailing whitespace.
 * @returns {number} The advance in points.
 */
function pieceAdvance(glyphsEnd, text) {
  if (!text) return 0;
  if (text.includes("\0")) return glyphsEnd(text);
  return Math.max(0, glyphsEnd(text + "o") - glyphsEnd("o"));
}

/**
 * Where a line of one run ends when Recipe draws it reordered: piece by piece
 * in visual order, the advance of each piece and the spaces after it, and
 * the glyphs of the last piece, without the spaces that end the line. Its
 * typed order can end a fraction of a point earlier or later, as other glyphs
 * end the line.
 *
 * @param {string} text The line as typed.
 * @param {string} direction The `TextDirection` of its paragraph.
 * @param {function(string): number} glyphsEnd Where the glyphs of a text in
 *   visual order end, in points, with character spacing.
 * @returns {number|null} The width in points, or null when the line keeps its
 *   logical order.
 */
function drawnLineWidth(text, direction, glyphsEnd) {
  // The spaces that end the line are dropped, wherever its indent goes.
  var segments = visualRuns([trimBreakableEnd(text)], direction);
  if (!segments) return null;
  return segments.reduce(function (width, segment, index) {
    var trimmed = segment.text.trimEnd();
    var spaces = segment.text.length - trimmed.length;
    // A piece before another ends where a glyph after it would start.
    width +=
      index < segments.length - 1
        ? pieceAdvance(glyphsEnd, trimmed)
        : trimmed
          ? glyphsEnd(trimmed)
          : 0;
    // Spaces that end the line take no room; an indent does.
    if (spaces && (segment.indent || index < segments.length - 1)) {
      width += spaceAdvance(glyphsEnd, segment.text.slice(trimmed.length));
    }
    return width;
  }, 0);
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
 * @param {Array<*>} [runGroups] The block each run belongs to, such as the
 * text() call it comes from: consecutive runs of one block with one direction
 * of their own are placed as one block. Undefined puts each run in its own.
 * @param {{text: string, start: number}} [context] The paragraph the line
 * is one line of, with the line's text at `start` in `text`, when the
 * paragraph wraps: the line is reordered with the levels of the whole
 * paragraph.
 * @returns {Array<{run: number, text: string, indent: (boolean|undefined)}>|null}
 * The segments, with the index of the run each one belongs to, or null when
 * the line keeps its logical order: for "none", for left-to-right text, for
 * a line of only whitespace and formatting characters, and for a line
 * holding a paragraph break.
 * @throws {TypeError} If `direction` or a run direction is not a
 * `TextDirection` value.
 */
function visualRuns(texts, direction, runDirections, runGroups, context) {
  direction = readDirection(direction);
  texts = texts.map(wellFormed);
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
  // Without right-to-left text in its paragraph, or a run or line that asks
  // for it, the line is drawn as typed, whatever its runs ask for.
  if (
    !hasReorderingCharacters(joined) &&
    !(context && paragraphReorders(context.text)) &&
    direction !== TextDirection.RTL &&
    modes.indexOf(TextDirection.RTL) === -1
  ) {
    return null;
  }
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
  /**
   * Whether two runs are in one block with one direction of their own.
   *
   * @param {number} run A run.
   * @param {number} other Another run, possibly out of range.
   * @returns {boolean} Whether they share an isolate.
   */
  function sameBlock(run, other) {
    return (
      runGroups !== undefined &&
      runGroups[run] !== undefined &&
      runGroups[run] === runGroups[other] &&
      modes[run] === modes[other]
    );
  }
  texts.forEach(function (text, run) {
    var mode = modes[run];
    var own = mode !== RUN_FOLLOWS;
    var open =
      !own || sameBlock(run, run - 1)
        ? ""
        : mode === TextDirection.RTL
          ? ISOLATE_RTL
          : ISOLATE_LTR;
    var close = own && !sameBlock(run, run + 1) ? POP_ISOLATE : "";
    var piece = open + text + close;
    for (var index = 0; index < piece.length; ++index) {
      owners.push(run);
      opaque.push(
        mode === RUN_KEPT &&
          index >= open.length &&
          index < piece.length - close.length,
      );
    }
    line += piece;
  });
  var edges = lineEdges(line);
  if (!edges[1]) return null;
  var leading = edges[0].length;
  var visual = visualCharacters(
    edges[1],
    direction === TextDirection.NONE ? TextDirection.LTR : direction,
    isolated ? opaque.slice(leading, leading + edges[1].length) : undefined,
    paragraphOf(context, joined, line, leading, isolated),
  );
  var characters = visual.characters.map(function (entry) {
    return { index: entry.index + leading, character: entry.character };
  });
  var index;
  for (index = leading + edges[1].length; index < line.length; ++index) {
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
  // A line whose runs all stay as they are, and in their order, keeps its
  // logical order.
  if (
    isolated &&
    ordered
      .map(function (segment) {
        return segment.text;
      })
      .join("") === joined &&
    ordered.every(function (segment, index) {
      return !index || segment.run >= ordered[index - 1].run;
    })
  ) {
    return null;
  }
  return ordered;
}

/**
 * The paragraph a line is reordered in, as `visualCharacters()` takes it: the
 * paragraph text itself while the line is that text, so its lines share it,
 * or the paragraph around the line as it is reordered, with its isolates.
 *
 * @param {{text: string, start: number}|undefined} context The paragraph.
 * @param {string} joined The line's runs as typed.
 * @param {string} line The line as it is reordered.
 * @param {number} leading The length of the whitespace the line starts with.
 * @param {boolean} isolated Whether the line places runs as isolates.
 * @returns {{text: string, offset: number}|undefined} The paragraph and where
 *   the line's text without its edge whitespace starts in it.
 */
function paragraphOf(context, joined, line, leading, isolated) {
  if (!context) return undefined;
  var offset = context.start + leading;
  if (
    !isolated &&
    context.text.substr(context.start, joined.length) === joined
  ) {
    return { text: context.text, offset: offset };
  }
  return {
    text:
      context.text.slice(0, context.start) +
      line +
      context.text.slice(context.start + joined.length),
    offset: offset,
  };
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
    var pattern = new RegExp(WORD + "|" + BREAKABLE_SPACE + "+", "g");
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

/**
 * Throw, as reordering would, when text drawn in a direction has to be
 * reordered and bidi-js is not loaded, so a call can check before it draws
 * anything. Text drawn as given, with "none", and left-to-right text in a
 * left-to-right paragraph need no bidi-js.
 *
 * @param {string} text The text.
 * @param {string} [direction] A `TextDirection` value; defaults to "none".
 * @returns {void}
 * @throws {Error} If the text needs bidi-js and it is not loaded.
 * @throws {TypeError} If `direction` is not a `TextDirection` value.
 */
function requireBidiFor(text, direction) {
  if (reorders(String(text), readDirection(direction))) getBidi();
}

/**
 * Remove the spaces that end a text and that a line drops, a next line
 * (U+0085) included; the no-break spaces U+00A0, U+2007 and U+202F stay.
 *
 * @param {string} value The text.
 * @returns {string} The trimmed text.
 */
function trimBreakableEnd(value) {
  return value.replace(TRAILING_BREAKABLE_SPACES, "");
}

export {
  TextDirection,
  readDirection,
  hasReorderingCharacters,
  hasStrongCharacter,
  resolveDirection,
  paragraphDirections,
  splitParagraphs,
  toVisual,
  drawnText,
  visualRuns,
  visualWords,
  spacedPieces,
  spacedGaps,
  spacedCharacters,
  spaceAdvance,
  pieceAdvance,
  drawnLineWidth,
  drawnGaps,
  useBidi,
  hasBidi,
  trimBreakableEnd,
  requireBidiFor,
  NO_BREAK_SPACES,
  LINE_BREAKS,
  BREAKABLE_SPACE,
  WORD,
};
