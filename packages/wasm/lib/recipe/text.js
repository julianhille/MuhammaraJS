import {
  AnnotSubtype,
  HorizontalAlign,
  TextAlign,
  TextWrap,
  VerticalAlign,
} from "../value-sets.js";
import { htmlToTextObjects } from "./htmlToTextObjects.js";
import { charSpacing, Column, resolveFontSize } from "./text.helper.js";
import { miterLimitOption, rotationOption } from "./vector.helper.js";
import {
  TextDirection,
  drawnText,
  readDirection,
  resolveDirection,
  spaceAdvance,
  splitParagraphs,
  toVisual,
  visualRuns,
  visualWords,
} from "../text-direction.js";

/**
 * Deep-merges plain option objects; arrays and dates are replaced, not merged.
 * @param {object} [left={}] - Base options.
 * @param {object} [right={}] - Overrides.
 * @returns {object} A new merged object.
 */
function merge(left = {}, right = {}) {
  var result = { ...left };
  Object.entries(right).forEach(([key, value]) => {
    result[key] =
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
        ? merge(result[key], value)
        : value;
  });
  return result;
}

/**
 * Expands CSS-style padding to four sides.
 * @param {number|number[]} [value=0] - One to four values: top, right, bottom, left.
 * @returns {number[]} `[top, right, bottom, left]`.
 */
function padding(value = 0) {
  var p = Array.isArray(value) ? value : [value];
  return [
    p[0] || 0,
    p[1] ?? p[0] ?? 0,
    p[2] ?? p[0] ?? 0,
    p[3] ?? p[1] ?? p[0] ?? 0,
  ];
}

/**
 * Splits text into wrapping units while keeping non-breaking spaces inside words.
 * @param {string} value - Text.
 * @returns {string[]} Words with their trailing breakable spaces.
 */
function splitWords(value) {
  return (
    String(value).match(
      /(?:\S|[\u00a0\u2007\u202f])+(?:(?![\u00a0\u2007\u202f])\s)*|(?:(?![\u00a0\u2007\u202f])\s)+/g,
    ) || [""]
  );
}

/**
 * Removes trailing breakable whitespace while preserving the non-breaking
 * spaces U+00A0, U+2007 and U+202F.
 * @param {string} value - Text.
 * @returns {string} The trimmed text.
 */
function trimBreakableEnd(value) {
  return value.replace(/(?:(?![\u00a0\u2007\u202f])\s)+$/, "");
}

/**
 * Reports whether a string contains visible text or a non-breaking space.
 * @param {string} value - Text.
 * @returns {boolean} Whether it has visible content.
 */
function hasText(value) {
  return /(?:\S|[\u00a0\u2007\u202f])/.test(value);
}

/**
 * Reports whether wrapping may occur at the start of a string.
 * @param {string} value - Text.
 * @returns {boolean} Whether it starts with breakable whitespace.
 */
function startsWithBreakableSpace(value) {
  return !/^[\u00a0\u2007\u202f]/.test(value) && /^\s/.test(value);
}

/**
 * Reports whether wrapping may occur at the end of a string.
 * @param {string} value - Text.
 * @returns {boolean} Whether it ends with breakable whitespace.
 */
function endsWithBreakableSpace(value) {
  return !/[\u00a0\u2007\u202f]$/.test(value) && /\s$/.test(value);
}

/**
 * Lays out plain text into lines for a width and wrap mode.
 * @param {string} value - Text; a line break such as `\n` or U+2028 starts a
 *   paragraph.
 * @param {number} width - Available width; 0 disables wrapping.
 * @param {function(string, object): TextDimensions} measure - Measures a run with options, including character spacing.
 * @param {object} options - Text options.
 * @param {Recipe.TextWrap|boolean} wrap - Wrap mode; `true` means auto.
 * @returns {Array<{text: string, last: boolean, direction: string}>} Lines in
 *   logical order; `last` ends a paragraph and `direction` is the resolved
 *   direction of the paragraph the line was wrapped from.
 */
function lines(value, width, measure, options, wrap) {
  var result = [];
  splitParagraphs(String(value)).forEach((paragraph) => {
    var direction = resolveDirection(paragraph, options.direction);
    var line = "";
    var truncated = false;
    var words = splitWords(paragraph);
    words.forEach((word) => {
      if (truncated) return;
      var next = line + word;
      // measure() already includes the character spacing.
      var fits = !width || measure(next, options).width <= width;
      if (fits || !line) {
        line = next;
      } else if (wrap === TextWrap.AUTO || wrap === true) {
        result.push({ text: trimBreakableEnd(line), last: false, direction });
        line = word;
      } else if (wrap === TextWrap.CLIP) {
        line = next;
      } else if (wrap === TextWrap.ELLIPSIS) {
        line = ellipsize(line || word, width, measure, options);
        truncated = true;
      } else {
        truncated = true;
      }
    });
    if (line || !result.length) {
      result.push({
        text: wrap === TextWrap.CLIP ? line : trimBreakableEnd(line),
        last: true,
        direction,
      });
    }
  });
  return result;
}

/**
 * Compares two shallow HTML style objects for equivalent entries.
 * @param {object} [left] - Styles.
 * @param {object} [right] - Styles.
 * @returns {boolean} Whether both have the same entries.
 */
function sameStyles(left, right) {
  var leftEntries = Object.entries(left || {});
  var rightEntries = Object.entries(right || {});
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([key, value]) => right?.[key] === value)
  );
}

/**
 * Combines text options with an HTML fragment's styles for drawing. Like
 * native, HTML underline and strike-out styles draw lines, while the same
 * option names on text() create text-markup annotations.
 * @param {RecipeTextOptions} options - Text options passed to text().
 * @param {object} [styles] - The HTML fragment's own styles.
 * @param {number} fontSize - Resolved font size for the fragment.
 * @returns {RecipeTextOptions} Options for drawing this fragment.
 */
function fragmentOptions(options, styles = {}, fontSize) {
  var { underline, strikeOut, ...rest } = styles;
  return {
    ...options,
    ...rest,
    // A flowed run keeps its own size; HTML fragments use the call's size.
    fontSize: rest.fontSize ?? fontSize,
    htmlUnderline: Boolean(underline),
    htmlStrikeOut: Boolean(strikeOut),
  };
}

/**
 * Coalesces adjacent HTML fragments that use equivalent styles.
 * @param {Array<{text: string, styles: object}>} parts - Fragments.
 * @returns {Array<{text: string, styles: object}>} New grouped fragments.
 */
function groupedHtmlParts(parts) {
  return parts.reduce((groups, part) => {
    var previous = groups[groups.length - 1];
    if (previous && sameStyles(previous.styles, part.styles)) {
      previous.text += part.text;
    } else {
      groups.push({ ...part });
    }
    return groups;
  }, []);
}

/**
 * Measures where the fragment after this one starts, as native Recipe places
 * separately drawn runs: at this fragment's right edge, plus the width of an
 * "o" when it ends with a space, the space width native measures.
 * @param {string} text - Fragment text.
 * @param {function(string, object): TextDimensions} measure - Measures a run with options, including character spacing.
 * @param {object} options - Fragment text options.
 * @returns {number} The advance in points, with spacing between its own
 *   characters but not after the last one.
 */
function fragmentAdvance(text, measure, options) {
  if (!text) return 0;
  return (
    measure(text, options).xMax +
    (endsWithBreakableSpace(text) ? measure("o", options).width : 0)
  );
}

/**
 * Measures styled HTML fragments and spacing across separate drawing runs.
 * @param {Array<{text: string, styles: object}>} parts - Fragments.
 * @param {function(string, object): TextDimensions} measure - Measures a run with options.
 * @param {object} options - Base text options.
 * @returns {number} The width in points.
 */
function htmlPartsWidth(parts, measure, options) {
  var groups = groupedHtmlParts(parts);
  // Fragments before the last span their advance, as they are drawn, with
  // their own character spacing; the line ends where the last one's glyphs
  // end. One fragment keeps the plain text width.
  return groups.reduce((sum, part, index) => {
    var textOptions = { ...options, ...part.styles };
    return (
      sum +
      (groups.length === 1
        ? measure(part.text, textOptions).width
        : index < groups.length - 1
          ? fragmentAdvance(part.text, measure, textOptions)
          : measure(part.text, textOptions).xMax)
    );
  }, 0);
}

// Every paragraph separator ends a line, as a line feed does.
var LINE_BREAK_SPLIT = /(\r\n|[\n\v\f\r\u0085\u2028\u2029])/;
var ENDS_WITH_LINE_BREAK = /[\n\v\f\r\u0085\u2028\u2029]$/;
// A line break followed only by spaces a line drops, at the end of a text;
// a non-breaking space holds its line.
var ENDS_WITH_DROPPED_LINE =
  /[\n\v\f\r\u0085\u2028\u2029](?:(?![\n\v\f\r\u0085\u2028\u2029\u00a0\u2007\u202f])\s)*$/;
// Text a line keeps: anything but breakable spaces.
var HAS_KEPT_TEXT = /[^\s]|[\n\v\f\r\u0085\u2028\u2029\u00a0\u2007\u202f]/;

/**
 * Splits a run's text at its line breaks.
 * @param {string} value - The run's text.
 * @returns {string[]} The text between breaks, with each break as "\n".
 */
function breakFragments(value) {
  return String(value)
    .split(LINE_BREAK_SPLIT)
    .map((fragment, index) => (index % 2 ? "\n" : fragment));
}

/**
 * Lays out styled HTML into lines while preserving list and break structure.
 * @param {object[]} source - Text objects from htmlToTextObjects(), or
 *   flowed runs from flowRunSource(); a `keepLeadingSpace` run keeps the
 *   spaces that start a line, as plain text does.
 * @param {number} width - Available width; 0 disables wrapping.
 * @param {function(string, object): TextDimensions} measure - Measures a run with options.
 * @param {object} options - Base text options.
 * @param {Recipe.TextWrap|boolean} wrap - Wrap mode.
 * @returns {Array<{text: string, parts: object[], last: boolean, direction: (Recipe.TextDirection|undefined)}>}
 *   Lines of styled fragments, each with the resolved direction of the
 *   paragraph it was wrapped from.
 */
function htmlLines(source, width, measure, options, wrap) {
  var result = [];
  var parts = [];
  var indent = 0;
  var linePrefix = "";
  var continuationPrefix = "";
  var truncated = false;
  /**
   * Emits the accumulated fragments and prepares the next line prefix.
   * @param {boolean} last - Whether the line ends a paragraph.
   * @param {boolean} [force=false] - Emit even an empty line.
   * @returns {void}
   */
  var flush = (last, force = false) => {
    // lines() trims every line it emits; keep trailing spaces out of the
    // measured width so alignment and justification stay correct.
    while (wrap !== TextWrap.CLIP && parts.length) {
      var tail = parts[parts.length - 1];
      tail.text = trimBreakableEnd(tail.text);
      if (tail.text) break;
      parts.pop();
    }
    if (!parts.length && !force && result.length) {
      if (!last) linePrefix = continuationPrefix;
      return;
    }
    result.push({
      text: parts.map((part) => part.text).join(""),
      parts,
      last,
      // The direction of the paragraph the line was wrapped from, as its
      // first run with text sees it.
      direction: (parts.find((part) => hasText(part.text)) || parts[0])
        ?.direction,
    });
    parts = [];
    if (!last) linePrefix = continuationPrefix;
  };

  // Every paragraph resolves its direction over all of its runs, as native
  // does, so a wrapped line keeps its paragraph's direction. A flowed run
  // resolves it with the direction its own call asked for.
  // A flowed HTML run that starts a new line after a block element starts a
  // new paragraph too.
  var paragraphTexts = [""];
  var firstParagraphs = source.map((sourcePart) => {
    if (sourcePart.breakBefore && paragraphTexts[paragraphTexts.length - 1]) {
      paragraphTexts.push("");
    }
    var first = paragraphTexts.length - 1;
    breakFragments(sourcePart.value).forEach((fragment) => {
      if (fragment === "\n") paragraphTexts.push("");
      else paragraphTexts[paragraphTexts.length - 1] += fragment;
    });
    return first;
  });
  var resolved = new Map();
  /**
   * The direction a run of a paragraph is laid out in.
   * @param {number} index - The paragraph.
   * @param {string|undefined} requested - The direction the run asked for.
   * @returns {string} A `Recipe.TextDirection` value.
   */
  var directionOf = (index, requested) => {
    var key = index + ":" + requested;
    if (!resolved.has(key)) {
      resolved.set(key, resolveDirection(paragraphTexts[index], requested));
    }
    return resolved.get(key);
  };
  var paragraph = 0;
  source.forEach((sourcePart, sourceIndex) => {
    paragraph = firstParagraphs[sourceIndex];
    var listMarker = false;
    // A flowed run keeps the direction its call asked for; the runs of one
    // text() call share it.
    var runDirection =
      sourcePart.styles?._flowRun !== undefined
        ? readDirection(sourcePart.styles.direction)
        : undefined;
    var requested =
      runDirection === undefined ? options.direction : runDirection;
    if (sourcePart.breakBefore && parts.length) flush(true);
    var collapseLeadingSpace = sourcePart.collapseLeadingSpace;
    if (sourcePart.indent !== undefined) {
      indent = sourcePart.indent;
      linePrefix = " ".repeat(indent);
      listMarker =
        indent > 0 && /^(?:\*|\d+\.) $/.test(String(sourcePart.value));
      // Native wraps list text beneath the item text, not beneath its marker.
      // A zero indent marks the end of the list, not a marker to wrap under.
      continuationPrefix = listMarker
        ? " ".repeat(indent + String(sourcePart.value).length + 1)
        : " ".repeat(indent);
    }
    breakFragments(sourcePart.value).forEach((fragment) => {
      var direction = directionOf(paragraph, requested);
      if (!fragment) return;
      if (fragment === "\n") {
        paragraph++;
        flush(true, true);
        // Native re-applies the indent on every line of a list item, so a
        // <br> or block break inside one stays indented.
        linePrefix = " ".repeat(indent);
        truncated = false;
        return;
      }
      // Same word split as lines(); a leading \s* would carry a fragment
      // boundary space onto the start of the next wrapped line.
      var words = splitWords(fragment);
      words.forEach((word) => {
        if (truncated) return;
        if (collapseLeadingSpace) {
          collapseLeadingSpace = false;
          var lastPart = parts[parts.length - 1];
          if (lastPart && endsWithBreakableSpace(lastPart.text)) {
            word = word.replace(/^(?:(?![\u00a0\u2007\u202f])\s)+/, "");
            if (!word) return;
          }
        }
        word = linePrefix + word;
        linePrefix = "";
        var candidate = [
          ...parts,
          {
            text: word,
            styles: sourcePart.styles,
            marker: listMarker,
            direction,
            runDirection,
          },
        ];
        var previousPart = parts[parts.length - 1];
        // As in native, a line may also break where one flowed run ends
        // and the next begins.
        var breakBefore =
          parts.length &&
          (endsWithBreakableSpace(previousPart.text) ||
            startsWithBreakableSpace(word) ||
            (sourcePart.styles?._flowRun !== undefined &&
              previousPart.styles?._flowRun !== sourcePart.styles._flowRun));
        if (
          width &&
          breakBefore &&
          htmlPartsWidth(candidate, measure, options) > width
        ) {
          if (wrap === TextWrap.AUTO || wrap === true) {
            flush(false);
            if (!hasText(word)) return;
            word = linePrefix + word;
            linePrefix = "";
          } else if (wrap === TextWrap.ELLIPSIS) {
            ellipsizeHtmlParts(parts, width, measure, options);
            truncated = true;
            return;
          } else if (wrap !== TextWrap.CLIP) {
            truncated = true;
            return;
          }
        }
        if (!parts.length && !hasText(word) && !sourcePart.keepLeadingSpace)
          return;
        parts.push({
          text: word,
          styles: sourcePart.styles,
          marker: listMarker,
          direction,
          runDirection,
        });
      });
    });
  });
  if (parts.length || !result.length) flush(true, !result.length);
  return result;
}

/**
 * Truncates styled fragments in place until a `…` fits the width.
 * @param {Array<{text: string, styles: object}>} parts - Fragments, changed in place.
 * @param {number} width - Available width.
 * @param {function(string, object): TextDimensions} measure - Measures a run with options.
 * @param {object} options - Base text options.
 * @returns {void}
 */
function ellipsizeHtmlParts(parts, width, measure, options) {
  var suffix = "…";
  while (parts.length) {
    var last = parts[parts.length - 1];
    var candidate = parts.map((part) => ({ ...part }));
    candidate[candidate.length - 1].text =
      trimBreakableEnd(candidate[candidate.length - 1].text) + suffix;
    if (htmlPartsWidth(candidate, measure, options) <= width) {
      last.text = trimBreakableEnd(last.text) + suffix;
      return;
    }
    last.text = trimBreakableEnd(last.text.slice(0, -1));
    if (!last.text) parts.pop();
  }
  parts.push({ text: suffix, styles: {} });
}

/**
 * Truncates text until it and an ellipsis fit the width.
 * @param {string} value - Text.
 * @param {number} width - Available width.
 * @param {function(string, object): TextDimensions} measure - Measures a run with options.
 * @param {object} options - Text options.
 * @returns {string} The truncated text ending in `…`.
 */
function ellipsize(value, width, measure, options) {
  var suffix = "…";
  var result = trimBreakableEnd(value);
  while (result.length && measure(result + suffix, options).width > width) {
    result = trimBreakableEnd(result.slice(0, -1));
  }
  return result + suffix;
}

/**
 * Keeps the lines that fit a height and joins the rest for overflow handling.
 * @param {Array<{text: string}>} entries - Laid-out lines.
 * @param {number} availableHeight - Height of the box content.
 * @param {number[]} lineHeights - Height of each line.
 * @returns {{entries: object[], linesWritten: number, remainder: string}} Visible lines and the remaining text.
 */
function clipEntries(entries, availableHeight, lineHeights) {
  var used = 0;
  var linesWritten = 0;
  while (
    linesWritten < entries.length &&
    // Tolerates rounding in the summed heights.
    used + lineHeights[linesWritten] <= availableHeight + 1e-9
  ) {
    used += lineHeights[linesWritten++];
  }
  var visibleEntries = entries.slice(0, linesWritten);
  return {
    entries: visibleEntries,
    linesWritten: visibleEntries.length,
    remainder: entries
      .slice(visibleEntries.length)
      .map((entry) => entry.text)
      .join("\n"),
  };
}

/**
 * Text options that describe the whole flowed text box rather than one run.
 * The call that ends a flow decides them, as in native, except that native
 * aligns each run by its own `textBox.textAlign`.
 */
var FLOW_BOX_OPTIONS = [
  "align",
  "cell",
  "flow",
  "html",
  "layout",
  "overflow",
  "textBox",
];

/**
 * Text-markup annotation subtypes by the text() option that requests them.
 */
var textMarkupSubtypes = {
  highlight: AnnotSubtype.HIGHLIGHT,
  underline: AnnotSubtype.UNDERLINE,
  strikeOut: AnnotSubtype.STRIKE_OUT,
  squiggly: AnnotSubtype.SQUIGGLY,
};

/**
 * Text options that add text-markup annotations to the run that sets them.
 */
var TEXT_MARKUP_OPTIONS = Object.keys(textMarkupSubtypes);

/**
 * HTML that opens with a block element, which starts a new line in a flow.
 */
var BLOCK_START = /^\s*<(?:p|div|ul|ol|li|h[1-6]|blockquote|pre)\b/i;

/**
 * Matches HTML that ends with a closed block element, which ends its line.
 */
var BLOCK_END = /<\/(?:p|div|ul|ol|li|h[1-6]|blockquote|pre)\s*>\s*$/i;

/**
 * Turns one flowed text() call into source fragments for htmlLines(), so a
 * flow lays out as one text box: each run continues the line where the
 * previous one ended and wraps with it.
 * @param {string} value - Text, or HTML when `options.html` is set.
 * @param {RecipeTextOptions} options - The run's options, merged with the flow's.
 * @param {number} fontSize - The run's resolved font size.
 * @param {number} index - Position of the run in its flow; keeps runs apart.
 * @returns {object[]} Fragments shaped like htmlToTextObjects() output.
 */
function flowRunSource(value, options, fontSize, index) {
  var styles = {};
  var markup = {};
  Object.keys(options).forEach((key) => {
    if (TEXT_MARKUP_OPTIONS.includes(key)) markup[key] = options[key];
    else if (!FLOW_BOX_OPTIONS.includes(key)) styles[key] = options[key];
  });
  delete styles.size;
  styles.fontSize = fontSize;
  styles._flowRun = index;
  // Text-markup annotations stay apart from HTML underline and strike-out
  // styles, which draw lines instead.
  if (TEXT_MARKUP_OPTIONS.some((key) => markup[key])) styles._markup = markup;
  // An empty run still gives an empty flow its font and line height. Plain
  // text keeps the spaces that start a line; HTML collapses them.
  if (!options.html) {
    return [{ value: String(value), styles, keepLeadingSpace: true }];
  }
  // Each HTML text node is a run of its own, as in native, even when the
  // run's options give its elements the same styles.
  var parts = htmlToTextObjects(value, options).map((part, node) => ({
    ...part,
    styles: { ...styles, ...part.styles, _flowNode: node },
  }));
  if (index > 0 && parts.length) {
    // As in native, a later HTML run that opens with a block element starts
    // a new line, and its first space collapses into one that ends the line.
    parts[0].breakBefore = BLOCK_START.test(value);
    parts[0].collapseLeadingSpace = true;
  }
  return parts;
}

// The measurements a Recipe keeps before it starts over.
var MEASURED_LIMIT = 4096;

/**
 * Creates Recipe text measurement, layout, and drawing methods.
 * @param {{drawText: Function, measure: Function, module: object, fontKey: Function}} dependencies - Run drawing and measuring callbacks, and the key of the font and size text options measure in.
 * @returns {object} Methods mixed into Recipe.prototype.
 */
export function createTextMethods({ drawText, measure, module, fontKey }) {
  // Each Recipe's measurements, by the font and size and the text: a flow
  // measures its line height and its words again and again, and each
  // measurement reads the glyphs from the font file.
  var measured = new WeakMap();

  /**
   * Measures text once for each font and size.
   * @param {Recipe} recipe - Recipe instance.
   * @param {string} text - Text, as drawn.
   * @param {object} options - Text options.
   * @returns {TextDimensions} A copy of the measurement.
   */
  function measureOnce(recipe, text, options) {
    var cache = measured.get(recipe);
    if (!cache) measured.set(recipe, (cache = new Map()));
    var key = fontKey(options) + "\u0000" + text;
    var result = cache.get(key);
    if (!result) {
      if (cache.size >= MEASURED_LIMIT) cache.clear();
      result = measure.call(recipe, text, options);
      cache.set(key, result);
    }
    return { ...result };
  }

  /**
   * Measures text including character spacing.
   * @param {Recipe} recipe - Recipe instance.
   * @param {string} value - Text.
   * @param {object} [options={}] - Text options.
   * @returns {TextDimensions} Bounds and width in points.
   */
  function dimensions(recipe, value, options = {}) {
    // Formatting characters that reordering drops are not measured. A piece
    // of a reordered line, marked _drawn, is already as it is drawn; other
    // text is in the order it is typed.
    var drawn = options._drawn
      ? String(value)
      : drawnText(String(value), options.direction);
    var result = measureOnce(recipe, drawn, options);
    var spacing = charSpacing(
      value,
      options.charSpace,
      options.direction,
      options._drawn,
    );
    result.width += spacing;
    result.xMax += spacing;
    return result;
  }

  /**
   * Runs drawing inside the requested rotation and skew graphics state.
   * @param {Recipe} recipe - Recipe instance.
   * @param {object} options - `rotation`, `rotationOrigin`, `skewX`, and `skewY`.
   * @param {function(): void} callback - Draws the content.
   * @returns {void}
   */
  function withTextTransform(recipe, options, callback) {
    if (!options.rotation && !options.skewX && !options.skewY) {
      callback();
      return;
    }
    recipe._save();
    if (options.rotation) {
      var origin = options.rotationOrigin || [0, 0];
      recipe._rotate(options.rotation, origin[0], origin[1]);
    }
    if (options.skewX || options.skewY) {
      recipe._transform(
        1,
        Math.tan(((options.skewY || 0) * Math.PI) / 180),
        Math.tan(((options.skewX || 0) * Math.PI) / 180),
        1,
        0,
        0,
      );
    }
    callback();
    recipe._restore();
  }

  /**
   * Writes link bounds transformed and clipped with their associated text.
   * @param {Recipe} recipe - Recipe instance.
   * @param {string} url - Link target.
   * @param {number} x - Left.
   * @param {number} y - Top.
   * @param {number} width - Width.
   * @param {number} height - Height.
   * @param {object} options - Rotation and skew options.
   * @param {{x: number, y: number, width: number, height: number}} [clip] - Visible box.
   * @returns {void}
   */
  function transformedLink(recipe, url, x, y, width, height, options, clip) {
    // A rotated clip box turns with its text, so the link is clipped before
    // it turns, where both are still upright.
    if (clip && (options.rotation || (!options.skewX && !options.skewY))) {
      var clippedRight = Math.min(x + width, clip.x + clip.width);
      var clippedBottom = Math.min(y + height, clip.y + clip.height);
      var origin = options.rotationOrigin || [x, y + height];
      x = Math.max(x, clip.x);
      y = Math.max(y, clip.y);
      width = clippedRight - x;
      height = clippedBottom - y;
      if (width <= 0 || height <= 0) return;
      options = { ...options, rotationOrigin: origin };
      clip = undefined;
    }
    if (!options.rotation && !options.skewX && !options.skewY) {
      recipe.link(url, x, y, width, height);
      return;
    }
    var bottomLeft = recipe._calibrateCoordinate(x, y, 0, -height);
    var points = [
      [bottomLeft.nx, bottomLeft.ny],
      [bottomLeft.nx + width, bottomLeft.ny],
      [bottomLeft.nx + width, bottomLeft.ny + height],
      [bottomLeft.nx, bottomLeft.ny + height],
    ];
    if (options.skewX || options.skewY) {
      var skewX = Math.tan(((options.skewX || 0) * Math.PI) / 180);
      var skewY = Math.tan(((options.skewY || 0) * Math.PI) / 180);
      points = points.map(([pointX, pointY]) => [
        pointX + skewX * pointY,
        skewY * pointX + pointY,
      ]);
    }
    if (options.rotation) {
      var origin = options.rotationOrigin || [x, y + height];
      var pdfOrigin = recipe._calibrateCoordinate(origin[0], origin[1]);
      var radians = (options.rotation * Math.PI) / 180;
      var cosine = Math.cos(radians);
      var sine = Math.sin(radians);
      points = points.map(([pointX, pointY]) => {
        var offsetX = pointX - pdfOrigin.nx;
        var offsetY = pointY - pdfOrigin.ny;
        // Clockwise, as the text it links is drawn.
        return [
          pdfOrigin.nx + cosine * offsetX + sine * offsetY,
          pdfOrigin.ny - sine * offsetX + cosine * offsetY,
        ];
      });
    }
    var left = Math.min(...points.map((point) => point[0]));
    var right = Math.max(...points.map((point) => point[0]));
    var bottom = Math.min(...points.map((point) => point[1]));
    var top = Math.max(...points.map((point) => point[1]));
    if (clip) {
      var clipBottomLeft = recipe._calibrateCoordinate(
        clip.x,
        clip.y,
        0,
        -clip.height,
      );
      left = Math.max(left, clipBottomLeft.nx);
      right = Math.min(right, clipBottomLeft.nx + clip.width);
      bottom = Math.max(bottom, clipBottomLeft.ny);
      top = Math.min(top, clipBottomLeft.ny + clip.height);
    }
    if (right <= left || top <= bottom) return;
    var page = recipe.getCurrentPageInfo();
    if (recipe._editingPage && page?.rotate) {
      points = [
        [left, bottom],
        [right, bottom],
        [right, top],
        [left, top],
      ].map(([pointX, pointY]) => {
        if (page.rotate === 90 || page.rotate === -270) {
          return [page.height - page.offsetX - pointY, page.offsetY + pointX];
        }
        if (page.rotate === 180 || page.rotate === -180) {
          return [page.width - pointX, page.height - pointY];
        }
        if (page.rotate === 270 || page.rotate === -90) {
          return [page.offsetX + pointY, page.width - page.offsetY - pointX];
        }
        return [pointX, pointY];
      });
      left = Math.min(...points.map((point) => point[0]));
      right = Math.max(...points.map((point) => point[0]));
      bottom = Math.min(...points.map((point) => point[1]));
      top = Math.max(...points.map((point) => point[1]));
    }
    recipe._linkPdf(url, left, bottom, right - left, top - bottom);
  }

  /**
   * Adds the text-markup annotations requested by text() options over one
   * drawn line. Only the outer text() options request annotations; HTML
   * `<u>` and `<s>` styles stay visual decoration, as in native Recipe.
   * An optional clip rectangle limits the annotation to visible line bounds.
   * @param {Recipe} recipe - Recipe instance.
   * @param {object} options - text() options with `highlight`, `underline`, `strikeOut`, or `squiggly`.
   * @param {number} x - Line left.
   * @param {number} baseline - Line baseline.
   * @param {number} width - Line width; nothing is added for 0.
   * @param {boolean} [validateOnly=false] - Validate the options without writing.
   * @param {{x: number, y: number, width: number, height: number}} [clip] - Visible box.
   * @returns {void}
   */
  function addTextMarkup(
    recipe,
    options,
    x,
    baseline,
    width,
    validateOnly = false,
    clip,
  ) {
    if (!width) return;
    var bounds;
    Object.entries(textMarkupSubtypes).forEach(([key, subtype]) => {
      if (!options[key]) return;
      // Native measures markup against one sample so every run on a line
      // gets the same height, including descenders and tall glyphs, and
      // boxes a fixed 0.2 text heights below the baseline to 1.2 above it.
      bounds ||= dimensions(
        recipe,
        "ABCDEFGHIJKLMNOPQRSTUVWXYZgjpqy|}",
        options,
      );
      var left = x;
      var right = x + width;
      var top = baseline - bounds.height * 1.2;
      var bottom = baseline + bounds.height * 0.2;
      if (clip) {
        left = Math.max(left, clip.x);
        right = Math.min(right, clip.x + clip.width);
        top = Math.max(top, clip.y);
        bottom = Math.min(bottom, clip.y + clip.height);
        if (right <= left || bottom <= top) return;
      }
      var markup = typeof options[key] === "object" ? options[key] : {};
      var annotation = {
        text: markup.text || "",
        color: markup.color,
        opacity: markup.opacity,
        replies: markup.replies,
        title: options.title,
        open: options.open,
        richText: options.richText,
        flag: options.flag,
        icon: options.icon,
        date: options.date,
        subject: options.subject,
        width: clip ? right - left : width,
        height: clip ? bottom - top : bounds.height * 1.4,
      };
      Object.keys(annotation).forEach((name) => {
        if (annotation[name] === undefined) delete annotation[name];
      });
      // annot() anchors the box at its top-left corner.
      if (validateOnly) {
        recipe._flushAnnotations(true, [
          {
            x: left,
            y: top,
            subtype,
            options: annotation,
          },
        ]);
      } else {
        recipe.annot(left, top, subtype, annotation);
      }
    });
  }

  /**
   * Draws a highlight rectangle using the same transform as its text.
   * @param {Recipe} recipe - Recipe instance.
   * @param {number} x - Left.
   * @param {number} y - Top.
   * @param {number} width - Width.
   * @param {number} height - Height.
   * @param {object} options - Rotation and skew options.
   * @param {{color: (string|undefined), opacity: (number|undefined)}} hilite - Highlight color and opacity.
   * @returns {void}
   */
  function drawHilite(recipe, x, y, width, height, options, hilite) {
    withTextTransform(recipe, options, () => {
      recipe.rectangle(x, y, width, height, {
        fill: hilite.color || "#ffff00",
        opacity: hilite.opacity ?? 0.5,
      });
    });
  }

  /**
   * Validates the options of a text() call before it changes any state, as
   * native does.
   * @param {Recipe} recipe - Recipe instance.
   * @param {RecipeTextOptions} options - The call's options.
   * @returns {number} The resolved font size.
   * @throws {RangeError} If the font size is not greater than zero or
   *   `miterLimit` is not a number of at least 1.
   * @throws {TypeError} If `rotation` or `charSpace` is not a finite number.
   * @throws {Error} If a markup option is invalid or the font cannot be loaded.
   */
  function validateRun(recipe, options) {
    rotationOption(options.rotation);
    readDirection(options.direction);
    // Text does not use the miter limit, but native rejects it like shapes do.
    miterLimitOption(options.miterLimit);
    // Drawing checks this only when the flow ends; native rejects the call.
    if (!Number.isFinite(options.charSpace ?? 0)) {
      throw new TypeError("charSpace must be a finite number");
    }
    var fontSize = resolveFontSize(options);
    addTextMarkup(recipe, { ...options, fontSize }, 0, 0, 1, true);
    dimensions(recipe, "", { ...options, fontSize });
    return fontSize;
  }

  /**
   * Validates one flowed text() call like an immediate one and returns its
   * source fragments.
   * @param {Recipe} recipe - Recipe instance.
   * @param {string} value - Text, or HTML when `options.html` is set.
   * @param {RecipeTextOptions} options - The run's options, merged with the flow's.
   * @param {number} index - Position of the run in its flow.
   * @returns {object[]} The run's fragments.
   * @throws {RangeError} If the font size is not greater than zero or
   *   `miterLimit` is not a number of at least 1.
   * @throws {TypeError} If `rotation` or `charSpace` is not a finite number.
   * @throws {Error} If a markup option is invalid or the font cannot be loaded.
   */
  function flowRun(recipe, value, options, index) {
    var fontSize = validateRun(recipe, options);
    return flowRunSource(value, options, fontSize, index);
  }

  return {
    /**
     * Measures text in PDF points using the selected font and character spacing.
     * The configured Recipe font is used when `options.font` is omitted. This
     * method does not draw text or change the cursor; returned bounds use font
     * metric coordinates rather than Recipe page coordinates.
     *
     * @name textDimensions
     * @function
     * @memberof Recipe#
     * @param {string} value - Text to measure.
     * @param {RecipeTextOptions} [options] - Font and measurement options.
     * @returns {TextDimensions} Text bounds and dimensions in PDF points.
     * @throws {RangeError} If `fontSize`, or its `size` alias, is given and is
     *   not greater than zero.
     * @throws {TypeError} If `direction` is not a `Recipe.TextDirection` value.
     * @throws {Error} If the requested font is not registered or cannot be loaded.
     */
    textDimensions(value, options = {}) {
      // null options act like omitted options.
      if (options === null) options = {};
      return dimensions(this, value, {
        ...options,
        fontSize: resolveFontSize(options),
      });
    },

    /**
     * Measures the height required by an internal text box.
     * @private
     * @param {string} value - Text or HTML.
     * @param {object} [options={}] - Text options with `textBox` or `cell`.
     * @returns {number} The height in points.
     */
    _measureTextBoxHeight(value, options = {}) {
      var box = options.textBox || options.cell || {};
      var [top, right, bottom, left] = padding(box.padding);
      var fontSize = resolveFontSize(options);
      var width = box.width || 0;
      var lineHeight =
        box.lineHeight ||
        dimensions(this, "ABCDEFGHIJKLMNOPQRSTUVWXYZgjpqy|}", {
          ...options,
          fontSize,
        }).height;
      var availableWidth = width ? width - left - right : 0;
      var textOptions = { ...options, fontSize };
      /**
       * Measures a fragment with the current Recipe font state.
       * @param {string} text - Text.
       * @param {object} partOptions - Text options.
       * @returns {TextDimensions} Bounds and width.
       */
      var measureText = (text, partOptions) =>
        dimensions(this, text, partOptions);
      var entries = options.html
        ? htmlLines(
            htmlToTextObjects(value, options),
            availableWidth,
            measureText,
            textOptions,
            box.wrap === false ? TextWrap.ELLIPSIS : box.wrap || TextWrap.AUTO,
          )
        : lines(
            value,
            availableWidth,
            measureText,
            textOptions,
            box.wrap === false ? TextWrap.ELLIPSIS : box.wrap || TextWrap.AUTO,
          );
      return (
        box.height ||
        Math.max(box.minHeight || 0, entries.length * lineHeight + top + bottom)
      );
    },

    /**
     * Defines named columns for flowing text or table placement.
     * Coordinates and dimensions are PDF points in Recipe's top-left coordinate
     * system, where x increases rightward and y increases downward. Zero values
     * use the corresponding page margin or available page extent. The layout is
     * stored under `id`; `options.reset` discards columns previously stored there.
     *
     * @name layout
     * @function
     * @memberof Recipe#
     * @param {string|number} id - Layout identifier used by text flow.
     * @param {number} [x=0] - Left position; zero uses the left margin.
     * @param {number} [y=0] - Top position; zero uses the top margin.
     * @param {number} [width=0] - Layout width; zero uses the available width.
     * @param {number} [height=0] - Layout height; zero uses the available height.
     * @param {RecipeLayoutOptions} [options] - Column definitions and reset behavior.
     * @returns {Recipe} The Recipe instance.
     */
    layout(id, x = 0, y = 0, width = 0, height = 0, options = {}) {
      this._layouts ||= {};
      if (options.reset || !this._layouts[id]) this._layouts[id] = [];
      x ||= this._margin.left;
      y ||= this._margin.top;
      width ||= this._pageWidth - x - this._margin.right;
      height ||= this._pageHeight - y - this._margin.bottom;
      var columns = options.columns;
      if (!columns) columns = [{}];
      if (typeof columns === "number") {
        var gap = options.gap || 18;
        var columnWidth = (width - gap * (columns - 1)) / columns;
        columns = Array.from({ length: columns }, () => ({
          width: columnWidth,
          gap,
        }));
      }
      columns.forEach((column) => {
        var item = new Column(
          x,
          y,
          // Table columns intentionally default to 100pt. A layout with no
          // explicit columns remains a single full-width text column.
          column.width || (Array.isArray(options.columns) ? 100 : width),
          height,
          column.text,
          column.name,
          merge({}, column),
        );
        item.gap = column.gap || 0;
        this._layouts[id].push(item);
        x += item.width + item.gap;
      });
      return this;
    },

    /**
     * Moves the text cursor downward by a number of line heights.
     * Movement is in Recipe's top-left coordinate system and resets x to the
     * current text box origin when one exists. The current line height defaults
     * to 14 points until text has established another value.
     *
     * Inside an open flow it ends the current line instead, even for a count
     * of 0, and leaves `count - 1` empty lines; the flow continues below them.
     * The cursor does not move until the flow is drawn, so the coordinates
     * are the flow's origin, as in native.
     *
     * @name movedown
     * @function
     * @memberof Recipe#
     * @param {number} [count=1] - Number of line heights to move.
     * @param {boolean} [returnCoords=false] - Return the new coordinates instead of the Recipe instance.
     * @returns {Recipe|RecipePosition} The Recipe instance, or the new `[x, y]`
     *   coordinates; inside a flow, the flow's origin.
     */
    movedown(count = 1, returnCoords = false) {
      var flow = this._pendingFlow;
      if (flow) {
        // Inside a flow, as in native, it ends the current line, even for a
        // count of 0, and leaves count - 1 empty lines; the flow continues
        // below them. A count of 0 leaves an ended line alone. The flow is
        // not laid out yet, so the coordinates are its origin, as in native.
        var lastValue = flow.source[flow.source.length - 1]?.value ?? "";
        flow.endsBlock = false;
        if (count > 0 || !ENDS_WITH_LINE_BREAK.test(lastValue))
          flow.source.push(
            ...flowRunSource(
              "\n".repeat(Math.max(count, 1)),
              flow.options,
              resolveFontSize(flow.options),
              flow.runs++,
            ),
          );
        return returnCoords ? [flow.x, flow.y] : this;
      }
      this._textCursor.x = this._textBoxOrigin?.x ?? this._textCursor.x;
      this._textCursor.y += count * (this._lastLineHeight || 14);
      return returnCoords ? [this._textCursor.x, this._textCursor.y] : this;
    },

    /**
     * Draws text on the active page and advances the Recipe text cursor.
     * Explicit x and y values are PDF points in Recipe's top-left coordinate
     * system, where x increases rightward and y increases downward. When they
     * are omitted, drawing starts at the cursor or margins. Text boxes, flow,
     * HTML styling, links, highlighting, clipping, and named layouts are
     * controlled by `RecipeTextOptions`.
     *
     * With `flow: true`, later calls without coordinates continue the line
     * where the previous run ended and wrap with it in one text box, as in
     * native. A call without coordinates flows unless it passes
     * `flow: false`. The flow is laid out when a call passes `flow: false`,
     * or when a call with coordinates, `table()`, or `endPage()` follows.
     *
     * @name text
     * @function
     * @memberof Recipe#
     * @param {string} [value=''] - Text or supported HTML source to draw.
     * @param {number|RecipeTextOptions} [x] - Left coordinate, or options when coordinates are omitted.
     * @param {number} [y] - Top coordinate.
     * @param {RecipeTextOptions} [options] - Text and layout options.
     * @returns {Recipe} The Recipe instance.
     * @throws {RangeError} If `fontSize`, or its `size` alias, is given and is
     *   not greater than zero, or `miterLimit` is not a number of at least 1.
     * @throws {TypeError} If `rotation` or `charSpace` is not a finite number,
     *   or `direction` is not a `Recipe.TextDirection` value.
     * @throws {Error} If a requested overflow layout is undefined, text clipping cannot be applied, or a requested font cannot be loaded.
     * @throws {Error} If a flow is started without an active page.
     */
    text(value = "", x, y, options = {}) {
      // null options act like omitted options.
      if (options === null) options = {};
      var positioned = typeof x !== "object" && x !== undefined;
      if (!positioned) options = x || {};
      var flow = this._pendingFlow;
      if (flow && !positioned) {
        // Without coordinates the call continues the flow, as in native,
        // unless it passes flow: false, which adds its text and ends it.
        options = merge(flow.options, options);
        var run = flowRun(this, value, options, flow.runs++);
        // As in native, an HTML run after one that closed a block element
        // starts a new line.
        if (options.html && flow.endsBlock && run.length) {
          run[0].breakBefore = true;
        }
        flow.source.push(...run);
        // A run without text leaves the line where the run before it did.
        if (run.some((part) => hasText(String(part.value)))) {
          flow.endsBlock = Boolean(options.html) && BLOCK_END.test(value);
        }
        flow.options = options;
        if (options.flow === false) this._flushTextFlow();
        return this;
      }
      // An invalid call leaves the open flow open, as in native.
      if (flow) validateRun(this, options);
      this._flushTextFlow();
      if (!positioned) {
        x = this._textCursor.x || this._margin.left;
        y = this._textCursor.y || this._margin.top;
      }
      // As in native, a call without coordinates flows unless it passes
      // flow: false.
      if (positioned ? options.flow : options.flow !== false) {
        // Text without a page throws when it is drawn; a flow is drawn later,
        // possibly on another page, so it is rejected up front.
        if (!this._pageHeight) {
          throw new Error("A page is required for coordinates");
        }
        // Flowed text is laid out when the flow ends, so later runs can
        // continue its last line.
        this._pendingFlow = {
          x,
          y,
          options,
          runs: 1,
          source: flowRun(this, value, options, 0),
          endsBlock: Boolean(options.html) && BLOCK_END.test(value),
        };
        return this;
      }
      return this._drawTextBox(value, x, y, options);
    },

    /**
     * Lays out and draws one text box: the text of a single text() call, or
     * every run of a flow when `flowSource` is given.
     * @private
     * @param {string} value - Text or supported HTML source to draw.
     * @param {number} x - Left coordinate in Recipe's top-left system.
     * @param {number} y - Top coordinate in Recipe's top-left system.
     * @param {RecipeTextOptions} options - Text and layout options of the box.
     * @param {object[]} [flowSource] - Fragments of a flow's runs, from flowRunSource().
     * @returns {Recipe} The Recipe instance.
     * @throws {RangeError} If the font size is not greater than zero or
     *   `miterLimit` is not a number of at least 1.
     * @throws {TypeError} If `rotation` is not a finite number.
     * @throws {Error} If a requested overflow layout is undefined, text clipping cannot be applied, or a requested font cannot be loaded.
     */
    _drawTextBox(value, x, y, options, flowSource) {
      // Validate before anything is drawn, as native does.
      rotationOption(options.rotation);
      miterLimitOption(options.miterLimit);
      readDirection(options.direction);
      var box = options.textBox || options.cell || {};
      var [top, right, bottom, left] = padding(box.padding);
      var layout = options.layout && this._layouts?.[options.layout];
      var column = layout?.[0];
      if (column) {
        x = column.x;
        y = column.y;
        box = merge(box, { width: column.width, height: column.height });
      }
      // Like native, rotation turns the whole text around the given point,
      // before alignment moves it.
      var textOrigin = [x, y];
      var fontSize = resolveFontSize(options);
      var width =
        box.width ||
        (flowSource ? this._pageWidth - x - this._margin.right : 0);
      // Validate every requested markup option before drawing any part of
      // this text call, so a later invalid subtype cannot leave partial output.
      addTextMarkup(this, { ...options, fontSize }, x, y, 1, true);
      var wrap =
        box.wrap === false ? TextWrap.ELLIPSIS : box.wrap || TextWrap.AUTO;
      /**
       * Measures a fragment with the current Recipe font state.
       * @param {string} text - Text.
       * @param {object} textOptions - Text options.
       * @returns {TextDimensions} Bounds and width.
       */
      var measureText = (text, textOptions) =>
        dimensions(this, text, textOptions);
      var source =
        flowSource || (options.html ? htmlToTextObjects(value, options) : null);
      var entries = source
        ? htmlLines(
            source,
            width ? width - left - right : 0,
            measureText,
            { ...options, fontSize },
            wrap,
          )
        : lines(
            String(value),
            width ? width - left - right : 0,
            measureText,
            { ...options, fontSize },
            wrap,
          ).map((line) => ({ ...line, styles: {} }));
      /**
       * Measures the line height of text with the given run styles.
       * @param {object} [styles] - Run styles over the box options.
       * @returns {number} The line height in points.
       */
      var styledLineHeight = (styles) =>
        dimensions(this, "ABCDEFGHIJKLMNOPQRSTUVWXYZgjpqy|}", {
          ...options,
          fontSize,
          ...styles,
        }).height;
      var lineHeight =
        box.lineHeight || styledLineHeight(flowSource?.[0]?.styles);
      // As in native, each line of a flow is as tall as its tallest run; an
      // empty line takes the height of the next line with text, or of the
      // line before it at the end.
      var entryHeights = entries.map(() => lineHeight);
      if (flowSource && !box.lineHeight) {
        var textHeights = entries.map((entry) => {
          var heights = (entry.parts || [])
            .filter((part) => part.text)
            .map((part) => styledLineHeight(part.styles));
          return heights.length ? Math.max(...heights) : undefined;
        });
        for (var index = entries.length - 1; index >= 0; index--) {
          entryHeights[index] =
            textHeights[index] ??
            (index < entries.length - 1 ? entryHeights[index + 1] : undefined);
        }
        entryHeights.forEach((height, index) => {
          if (height === undefined) {
            entryHeights[index] = index ? entryHeights[index - 1] : lineHeight;
          }
        });
      }
      if (box.onClip && !box.clipIfExceedsBox) {
        console.warn(
          "textBox.onClip will not be called unless textBox.clipIfExceedsBox is true.",
        );
      }
      var clipResult;
      if (box.clipIfExceedsBox && box.height !== undefined) {
        var clipped = clipEntries(
          entries,
          box.height - top - bottom,
          entryHeights,
        );
        entries = clipped.entries;
        if (clipped.remainder.length) {
          clipResult = {
            remainder: clipped.remainder,
            linesWritten: clipped.linesWritten,
            clipped: true,
            bounds: { x, y, width, height: box.height },
          };
        }
      }
      var contentHeight = Math.max(
        box.minHeight || 0,
        entries.reduce((sum, entry, index) => sum + entryHeights[index], 0) +
          top +
          bottom,
      );
      var height = box.height || contentHeight;
      var topAlign = options.align?.split(" ") || [];
      /**
       * Measures a line with per-fragment HTML styles when present.
       * @param {{text: (string|undefined), parts: (object[]|undefined)}} entry - Laid-out line.
       * @returns {number} The width in points.
       */
      var entryWidth = (entry) =>
        entry.parts
          ? htmlPartsWidth(
              entry.parts,
              (text, textOptions) => dimensions(this, text, textOptions),
              { ...options, fontSize },
            )
          : dimensions(this, entry.text, options).width;
      var widestEntry = Math.max(...entries.map(entryWidth), 0);
      var naturalWidth = width || widestEntry;
      if (topAlign[0] === HorizontalAlign.CENTER) x -= naturalWidth / 2;
      else if (topAlign[0] === HorizontalAlign.RIGHT) x -= naturalWidth;
      if (topAlign[1] === VerticalAlign.CENTER) y -= height / 2;
      else if (topAlign[1] === VerticalAlign.BOTTOM) y -= height;
      if (box.style)
        this.rectangle(
          x,
          y,
          width || widestEntry + left + right,
          height,
          box.style.borderRadius === true
            ? { ...box.style, borderRadius: 5 }
            : box.style,
        );
      var vertical = box.textAlign?.split(" ")[1];
      var verticalOffset =
        vertical === VerticalAlign.CENTER
          ? (height - contentHeight) / 2
          : vertical === VerticalAlign.BOTTOM
            ? height - contentHeight
            : 0;
      var currentY = y + top + verticalOffset;
      var columnIndex = 0;
      var lastLineY;
      var lastLineIndex;
      entries.some((entry, index) => {
        var lineHeight = entryHeights[index];
        if (
          layout &&
          currentY + lineHeight >
            layout[columnIndex].y + layout[columnIndex].height
        ) {
          columnIndex++;
          if (columnIndex === layout.length) {
            var order = options.overflow?.call(this, this);
            if (order === true) return true;
            if (order?.layout !== undefined) {
              layout = this._layouts?.[order.layout];
              if (!layout)
                throw new Error(`Layout '${order.layout}' is undefined.`);
            }
            if (Array.isArray(order?.column)) {
              var old = layout[0].position;
              layout.forEach((item) => {
                item.x += order.column[0] - old[0];
                item.y += order.column[1] - old[1];
              });
              columnIndex = 0;
            } else {
              columnIndex = order?.column ?? 0;
            }
            if (!layout[columnIndex]) return true;
          }
          x = layout[columnIndex].x;
          y = layout[columnIndex].y;
          currentY = y + top;
        }
        // A plain line that reorders is drawn like a line of one styled
        // run, piece by piece in visual order, as native does. It keeps its
        // segments, so it is reordered once.
        var plainSegments =
          !entry.parts && visualRuns([entry.text], entry.direction);
        if (plainSegments) {
          entry = {
            ...entry,
            parts: [{ text: entry.text, styles: {} }],
            segments: plainSegments,
          };
        }
        var textOptions = fragmentOptions(options, entry.styles, fontSize);
        var entryDimensions = entry.parts
          ? null
          : dimensions(this, entry.text, textOptions);
        var textWidth = entry.parts
          ? htmlPartsWidth(
              entry.parts,
              (text, partOptions) => dimensions(this, text, partOptions),
              { ...options, fontSize },
            )
          : entryDimensions.width;
        // Lines are aligned by where their glyphs end, as native does: the
        // width of the glyphs before the last run plus the last run's xMax,
        // so right-aligned text ends at the edge instead of a bearing past it.
        // htmlPartsWidth() measures a line of one run from its first glyph
        // to its last, and a line of several from its start already.
        var runs = entry.parts ? groupedHtmlParts(entry.parts) : undefined;
        var lastRun = runs?.length === 1 ? runs[0] : undefined;
        var alignWidth = entry.parts
          ? textWidth +
            (lastRun
              ? dimensions(
                  this,
                  lastRun.text,
                  fragmentOptions(options, lastRun.styles, fontSize),
                ).xMin
              : 0)
          : entryDimensions.xMax;
        var horizontal = box.textAlign?.split(" ")[0];
        var isJustifiedLine =
          horizontal === TextAlign.JUSTIFY && !entry.last && width;
        // The last line of a justified paragraph starts at the paragraph's
        // start, which is the right edge for a right-to-left paragraph.
        if (
          horizontal === TextAlign.JUSTIFY &&
          entry.last &&
          entry.direction === TextDirection.RTL
        ) {
          horizontal = TextAlign.RIGHT;
        }
        var drawX =
          x +
          left +
          (horizontal === TextAlign.CENTER
            ? (width - left - right - alignWidth) / 2
            : horizontal === TextAlign.RIGHT
              ? width - left - right - alignWidth
              : 0);
        var baseline = currentY + lineHeight;
        if (textOptions.rotation && !textOptions.rotationOrigin) {
          textOptions.rotationOrigin = textOrigin;
        }
        // A clipped right-to-left line that overflows keeps its start, at
        // the right edge, and loses its end.
        if (
          wrap === TextWrap.CLIP &&
          width &&
          entry.direction === TextDirection.RTL &&
          alignWidth > width - left - right
        ) {
          drawX = x + width - right - alignWidth;
        }
        var linkX = drawX;
        var linkWidth = textWidth;
        var clipping = wrap === TextWrap.CLIP && width;
        var clip = clipping
          ? {
              x: x + left,
              y: currentY,
              width: width - left - right,
              height: lineHeight,
            }
          : undefined;
        /**
         * Saves the graphics state and clips to the line's box. Native clips
         * each rotated run inside its form, so the clip box turns with the
         * text: turn, clip, and turn back.
         * @param {object} runOptions - The text options of what is clipped.
         * @returns {void}
         */
        var clipLine = (runOptions) => {
          var clipPoint = this._calibrateCoordinate(
            x + left,
            currentY,
            0,
            -lineHeight,
          );
          this._save();
          var clipRotation = runOptions.rotation
            ? Number(runOptions.rotation)
            : 0;
          if (clipRotation)
            this._rotate(clipRotation, ...runOptions.rotationOrigin);
          if (this._pageContext) {
            this._pageContext
              .re(clipPoint.nx, clipPoint.ny, width - left - right, lineHeight)
              .W()
              .n();
          } else if (
            !module._muhammara_wasm_recipe_clip_rectangle(
              this._recipe,
              clipPoint.nx,
              clipPoint.ny,
              width - left - right,
              lineHeight,
            )
          ) {
            this._restore();
            throw new Error("Unable to clip text box");
          }
          if (clipRotation)
            this._rotate(-clipRotation, ...runOptions.rotationOrigin);
        };
        // A flow keeps rotation on its runs, which may turn differently, so
        // each run of a rotated flow is clipped on its own.
        var clipEachPart =
          clipping &&
          !textOptions.rotation &&
          entry.parts?.some(
            (part) => fragmentOptions(options, part.styles, fontSize).rotation,
          );
        if (clipping && !clipEachPart) clipLine(textOptions);
        // Each reordered piece is measured once: where its glyphs end,
        // without its trailing whitespace, and the advance of that
        // whitespace as drawn. The space advance is measured once per style.
        var spaceAdvances = new Map();
        var pieceMetrics = new Map();
        /**
         * The glyph width and trailing-space advance of a reordered piece.
         * @param {{text: string, styles: object}} part - Piece in visual order.
         * @returns {{ink: number, space: number}} The widths in points.
         */
        /**
         * Where the line's last reordered piece ends with the spaces it
         * keeps, such as a clipped line's or a no-break space, measured as
         * the line is when drawn as typed.
         * @param {{text: string}} part - Piece in visual order.
         * @param {object} partOptions - The piece's text options.
         * @returns {number} The width in points.
         */
        var keptSpacesWidth = (part, partOptions) => {
          var drawnOptions = { ...partOptions };
          // The piece is in visual order already.
          drawnOptions._drawn = true;
          return dimensions(this, part.text, drawnOptions).xMax;
        };
        var metricsOf = (part) => {
          if (!pieceMetrics.has(part)) {
            var partOptions = {
              ...fragmentOptions(options, part.styles, fontSize),
            };
            // The piece is in visual order already.
            partOptions._drawn = true;
            var trimmed = part.text.replace(/\s+$/, "");
            var spaces = part.text.length - trimmed.length;
            if (spaces && !spaceAdvances.has(part.styles)) {
              spaceAdvances.set(
                part.styles,
                spaceAdvance(
                  (text) => dimensions(this, text, partOptions).xMax,
                ),
              );
            }
            pieceMetrics.set(part, {
              ink: trimmed ? dimensions(this, trimmed, partOptions).xMax : 0,
              space: spaces ? spaces * spaceAdvances.get(part.styles) : 0,
            });
          }
          return pieceMetrics.get(part);
        };
        if (textOptions.hilite && !entry.parts) {
          var hilite =
            typeof textOptions.hilite === "object" ? textOptions.hilite : {};
          var bounds = dimensions(this, entry.text, textOptions);
          drawHilite(
            this,
            drawX + bounds.xMin,
            baseline - bounds.yMax,
            bounds.xMax - bounds.xMin,
            bounds.yMax - bounds.yMin,
            textOptions,
            hilite,
          );
        }
        if (entry.parts) {
          var justify =
            horizontal === TextAlign.JUSTIFY && !entry.last && width;
          var logicalParts = justify
            ? entry.parts
            : groupedHtmlParts(entry.parts);
          // Parts that reorder are drawn as one line in visual order, piece
          // by piece, each piece with its own part's styles.
          // Each flowed run keeps the direction its call asked for: a run
          // that asked for another direction than the line's is placed as
          // one block, and an "auto" run follows the line, or its paragraph
          // in a "none" line, as native does.
          var segments =
            entry.segments ||
            visualRuns(
              logicalParts.map((part) => part.text),
              entry.direction,
              logicalParts.map((part) =>
                part.runDirection === TextDirection.AUTO
                  ? entry.direction === TextDirection.NONE
                    ? part.direction
                    : undefined
                  : part.runDirection,
              ),
            );
          var drawParts = segments
            ? (justify ? visualWords(segments) : segments).map((piece) => ({
                ...logicalParts[piece.run],
                text: piece.text,
                // The whole run the piece is cut from, which gives every
                // piece of the run the same hilite height.
                runText: logicalParts[piece.run].text,
                gap: piece.gap,
                indent: piece.indent,
                visual: true,
              }))
            : logicalParts;
          /**
           * Reports whether this fragment owns an expandable justification gap.
           * @param {{text: string, marker: (boolean|undefined)}} part - Fragment.
           * @param {number} index - Fragment index.
           * @returns {boolean} Whether justification may widen the gap after it.
           */
          var hasGapAfter = (part, index) =>
            justify &&
            (part.visual
              ? part.gap
              : !part.marker &&
                endsWithBreakableSpace(part.text) &&
                drawParts.slice(index + 1).some((next) => hasText(next.text)));
          /**
           * Measures how far the pen moves past a fragment, before its
           * justification gap. As in native, a justified word ends at its
           * glyphs, so every gap on the line gets the same width whatever
           * the size of the space before it.
           * @param {{text: string}} part - Fragment.
           * @param {number} index - Fragment index.
           * @param {object} partOptions - The fragment's text options.
           * @returns {number} The advance in points.
           */
          var partAdvance = (part, index, partOptions) => {
            var measured = dimensions(this, part.text, partOptions);
            if (hasGapAfter(part, index)) return measured.xMax;
            // The pen moves on by each fragment's advance; the line, as
            // htmlPartsWidth() measures it, ends at the last one's glyphs.
            if (index < drawParts.length - 1) {
              return fragmentAdvance(
                part.text,
                (text, textOptions) => dimensions(this, text, textOptions),
                partOptions,
              );
            }
            return drawParts.length > 1 ? measured.xMax : measured.width;
          };
          var partGaps = drawParts.filter(hasGapAfter).length;
          /**
           * The room a reordered piece needs on a justified line, as on
           * native: where its glyphs end, or all of an indent.
           * @param {{text: string, styles: object, indent: (boolean|undefined)}} part - Piece.
           * @returns {number} The width in points.
           */
          var justifiedRoom = (part) =>
            metricsOf(part).ink + (part.indent ? metricsOf(part).space : 0);
          var drawnWidth = textWidth;
          if (justify && segments) {
            drawnWidth = drawParts.reduce(
              (sum, part) => sum + justifiedRoom(part),
              0,
            );
          } else if (justify) {
            drawnWidth = drawParts.reduce(
              (sum, part, index) =>
                sum +
                partAdvance(
                  part,
                  index,
                  fragmentOptions(options, part.styles, fontSize),
                ),
              0,
            );
          }
          var partGap =
            partGaps > 0 ? (width - left - right - drawnWidth) / partGaps : 0;
          // A justified right-to-left line with no gap to widen, such as one
          // long word, starts at its start edge, the right edge, as native.
          if (
            segments &&
            justify &&
            !partGaps &&
            entry.direction === TextDirection.RTL
          ) {
            drawX = x + width - right - drawnWidth;
            linkX = drawX;
          }
          if (segments && !justify) {
            // Align the reordered pieces by their own width; trailing
            // whitespace at the end of the line takes no room.
            var pieceWidths = drawParts.map(
              (part) => metricsOf(part).ink + metricsOf(part).space,
            );
            // Trailing whitespace at the end of the line takes no room, an
            // indent does.
            var lastPart = drawParts[drawParts.length - 1];
            var piecesWidth = pieceWidths.reduce(
              (sum, value) => sum + value,
              0,
            );
            if (!lastPart.indent) {
              piecesWidth -= metricsOf(lastPart).space;
            }
            drawX =
              x +
              left +
              (horizontal === TextAlign.CENTER
                ? (width - left - right - piecesWidth) / 2
                : horizontal === TextAlign.RIGHT ||
                    (wrap === TextWrap.CLIP &&
                      entry.direction === TextDirection.RTL &&
                      piecesWidth > width - left - right)
                  ? width - left - right - piecesWidth
                  : 0);
            // Links and text markup start where the line now starts.
            linkX = drawX;
          }
          var rotationOrigin = options.rotationOrigin || textOrigin;
          drawParts.forEach((part, partIndex) => {
            var partOptions = fragmentOptions(options, part.styles, fontSize);
            if (partOptions.rotation && !partOptions.rotationOrigin) {
              partOptions.rotationOrigin = rotationOrigin;
            }
            var partWidth = !part.visual
              ? dimensions(this, part.text, partOptions).width
              : justify
                ? justifiedRoom(part)
                : partIndex === drawParts.length - 1 &&
                    !part.indent &&
                    /\S\s+$/.test(part.text)
                  ? keptSpacesWidth(part, partOptions)
                  : metricsOf(part).ink + metricsOf(part).space;
            if (clipEachPart) clipLine(partOptions);
            if (partOptions.hilite) {
              var partHilite =
                typeof partOptions.hilite === "object"
                  ? partOptions.hilite
                  : {};
              var partBounds = dimensions(
                this,
                part.visual ? part.runText : part.text,
                partOptions,
              );
              var partHiliteBounds = partBounds.height
                ? partBounds
                : dimensions(
                    this,
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZgjpqy|}",
                    partOptions,
                  );
              // A reordered piece's width is measured from its start, as on
              // native, not from its first glyph's edge.
              drawHilite(
                this,
                drawX + (part.visual ? 0 : partHiliteBounds.xMin),
                baseline - partHiliteBounds.yMax,
                partWidth + (hasGapAfter(part, partIndex) ? partGap : 0),
                partHiliteBounds.yMax - partHiliteBounds.yMin,
                partOptions,
                partHilite,
              );
            }
            // A reordered piece's underline and strike-out end at its
            // glyphs, without the spaces that end the piece.
            var drawOptions = partOptions;
            if (part.visual) {
              drawOptions = { ...partOptions };
              drawOptions._decorationWidth = metricsOf(part).ink;
            }
            drawText.call(
              this,
              part.visual ? part.text : toVisual(part.text, entry.direction),
              drawX,
              baseline,
              drawOptions,
            );
            if (clipEachPart) this._restore();
            if (partOptions.link) {
              var linkBounds = dimensions(this, part.text, partOptions);
              var nextPart = drawParts
                .slice(partIndex + 1)
                .find((next) => hasText(next.text));
              // A gap is linked when the text after it opens the same link.
              // A plain reordered line is one part whose link is the text
              // option's; HTML parts keep their own links.
              var coversGap =
                hasGapAfter(part, partIndex) &&
                nextPart !== undefined &&
                (part.visual
                  ? fragmentOptions(options, nextPart.styles, fontSize).link
                  : nextPart.styles.link) === partOptions.link;
              var partLinkX = drawX + (part.visual ? 0 : linkBounds.xMin);
              var partLinkWidth = partWidth + (coversGap ? partGap : 0);
              if (partLinkWidth)
                transformedLink(
                  this,
                  partOptions.link,
                  partLinkX,
                  currentY,
                  partLinkWidth,
                  lineHeight,
                  partOptions,
                  clip,
                );
            }
            if (partOptions._markup) {
              addTextMarkup(
                this,
                { ...partOptions, ...partOptions._markup },
                drawX,
                baseline,
                hasText(part.text) ? partWidth : 0,
                false,
                clip,
              );
            }
            // A reordered piece moves the pen by the room it was given.
            drawX += part.visual
              ? partWidth
              : partAdvance(part, partIndex, partOptions);
            if (hasGapAfter(part, partIndex)) drawX += partGap;
          });
          // Text markup of a line that keeps its order ends where its
          // glyphs end, as the line is aligned.
          linkWidth = segments || justify ? drawX - linkX : alignWidth;
        } else if (isJustifiedLine) {
          // Non-breaking spaces stay inside their word, as on native.
          var words = entry.text.match(
            /(?:[^\s]|[\u00a0\u2007\u202f])+(?:(?![\u00a0\u2007\u202f])\s)*/g,
          ) || [entry.text];
          var wordsWidth = words.reduce(
            (sum, word) => sum + dimensions(this, word, textOptions).width,
            0,
          );
          var gap =
            words.length > 1
              ? (width - left - right - wordsWidth) / (words.length - 1)
              : 0;
          words.forEach((word) => {
            drawText.call(this, word, drawX, baseline, textOptions);
            drawX += dimensions(this, word, textOptions).width + gap;
          });
          linkWidth = width - left - right;
        } else {
          // A line of only direction marks and spaces draws without the
          // marks, as native does.
          drawText.call(
            this,
            toVisual(entry.text, entry.direction),
            drawX,
            baseline,
            textOptions,
          );
        }
        if (clipping && !clipEachPart) this._restore();
        // Text-markup annotations span to the run's right glyph edge, like
        // native, while links, multi-run, and justified lines keep the
        // advance width they need for accurate click and gap placement.
        var markupWidth =
          entryDimensions && !isJustifiedLine
            ? entryDimensions.xMax
            : linkWidth;
        addTextMarkup(
          this,
          { ...options, fontSize },
          linkX,
          baseline,
          hasText(entry.text) ? markupWidth : 0,
          false,
          clipping
            ? {
                x: x + left,
                y: currentY,
                width: width - left - right,
                height: lineHeight,
              }
            : undefined,
        );
        if (textOptions.link && !entry.parts) {
          var linkBounds = dimensions(this, entry.text, textOptions);
          transformedLink(
            this,
            textOptions.link,
            linkX + linkBounds.xMin,
            currentY,
            linkWidth,
            lineHeight,
            textOptions,
            clip,
          );
        }
        // The vertical alignment offset only applies in the first column.
        lastLineY = currentY - (columnIndex ? 0 : verticalOffset);
        lastLineIndex = index;
        currentY += lineHeight;
        return false;
      });
      // movedown() moves by the first line's height, as in native.
      this._lastLineHeight = entryHeights[0] ?? lineHeight;
      // As in native, the cursor sits one first-line height above the bottom
      // of the last line, without padding or vertical alignment, so
      // movedown() moves right below the box and a call without coordinates
      // starts on its last line. With lines of one height, that is the top of
      // the last line.
      this._textCursor = {
        x,
        y:
          lastLineY === undefined
            ? y
            : lastLineY -
              top +
              (entryHeights[lastLineIndex] - this._lastLineHeight),
      };
      // As in native, styled text that ends its last line, with any line
      // break or with movedown() in a flow, leaves the cursor on the line
      // after it.
      // Spaces after the break, such as a run of only a space, stay on the
      // line the break started.
      var lastPart = source?.findLast((part) =>
        HAS_KEPT_TEXT.test(String(part.value)),
      );
      if (ENDS_WITH_DROPPED_LINE.test(String(lastPart?.value ?? ""))) {
        this._textCursor.y += this._lastLineHeight;
      }
      this._textBoxOrigin = { x, y };
      if (clipResult && typeof box.onClip === "function") {
        box.onClip(this, clipResult);
      }
      return this;
    },

    /**
     * Draws the pending flow, if any, as one text box. text() with
     * coordinates, table(), and endPage() end a flow the same way.
     * @private
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If a requested overflow layout is undefined or text
     *   clipping cannot be applied.
     */
    _flushTextFlow() {
      var flow = this._pendingFlow;
      if (!flow) return this;
      this._pendingFlow = null;
      // Only the box comes from the call that ended the flow; every run
      // carries its own styles, so the last run's cannot leak onto the
      // runs before it.
      var options = {};
      FLOW_BOX_OPTIONS.forEach((key) => {
        if (key in flow.options) options[key] = flow.options[key];
      });
      delete options.flow;
      delete options.html;
      return this._drawTextBox("", flow.x, flow.y, options, flow.source);
    },
  };
}
