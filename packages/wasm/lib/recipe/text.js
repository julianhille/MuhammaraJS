import { htmlToTextObjects } from "./htmlToTextObjects.js";
import { charSpacing, Column } from "./text.helper.js";

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

function padding(value = 0) {
  var p = Array.isArray(value) ? value : [value];
  return [
    p[0] || 0,
    p[1] ?? p[0] ?? 0,
    p[2] ?? p[0] ?? 0,
    p[3] ?? p[1] ?? p[0] ?? 0,
  ];
}

/** Splits text into wrapping units while keeping non-breaking spaces inside words. */
function splitWords(value) {
  return (
    String(value).match(
      /(?:\S|\u00a0)+(?:(?!\u00a0)\s)*|(?:(?!\u00a0)\s)+/g,
    ) || [""]
  );
}

/** Removes trailing breakable whitespace while preserving U+00A0. */
function trimBreakableEnd(value) {
  return value.replace(/(?:(?!\u00a0)\s)+$/, "");
}

/** Reports whether a string contains visible text or a non-breaking space. */
function hasText(value) {
  return /(?:\S|\u00a0)/.test(value);
}

/** Reports whether wrapping may occur at the start of a string. */
function startsWithBreakableSpace(value) {
  return value[0] !== "\u00a0" && /^\s/.test(value);
}

/** Reports whether wrapping may occur at the end of a string. */
function endsWithBreakableSpace(value) {
  return value[value.length - 1] !== "\u00a0" && /\s$/.test(value);
}

function lines(value, width, measure, options, wrap) {
  var result = [];
  String(value)
    .split("\n")
    .forEach((paragraph) => {
      var line = "";
      var truncated = false;
      var words = splitWords(paragraph);
      words.forEach((word) => {
        if (truncated) return;
        var next = line + word;
        var fits =
          !width ||
          measure(next, options).width + charSpacing(next, options.charSpace) <=
            width;
        if (fits || !line) {
          line = next;
        } else if (wrap === "auto" || wrap === true) {
          result.push({ text: trimBreakableEnd(line), last: false });
          line = word;
        } else if (wrap === "clip") {
          line = next;
        } else if (wrap === "ellipsis") {
          line = ellipsize(line || word, width, measure, options);
          truncated = true;
        } else {
          truncated = true;
        }
      });
      if (line || !result.length) {
        result.push({
          text: wrap === "clip" ? line : trimBreakableEnd(line),
          last: true,
        });
      }
    });
  return result;
}

/** Compares two shallow HTML style objects for equivalent entries. */
function sameStyles(left, right) {
  var leftEntries = Object.entries(left || {});
  var rightEntries = Object.entries(right || {});
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([key, value]) => right?.[key] === value)
  );
}

/** Coalesces adjacent HTML fragments that use equivalent styles. */
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

/** Measures styled HTML fragments and spacing across separate drawing runs. */
function htmlPartsWidth(parts, measure, options, group = true) {
  var groups = group ? groupedHtmlParts(parts) : parts;
  var text = groups.map((part) => part.text).join("");
  var measured = groups.reduce((sum, part) => {
    var textOptions = { ...options, ...part.styles };
    return sum + measure(part.text, textOptions).width;
  }, 0);
  var groupedSpacing = groups.reduce((sum, part) => {
    var textOptions = { ...options, ...part.styles };
    return sum + charSpacing(part.text, textOptions.charSpace);
  }, 0);
  return measured + charSpacing(text, options.charSpace) - groupedSpacing;
}

/** Calculates the character spacing needed between separately drawn runs. */
function boundaryCharSpacing(left, right, charSpace) {
  return (
    charSpacing(left + right, charSpace) -
    charSpacing(left, charSpace) -
    charSpacing(right, charSpace)
  );
}

/** Lays out styled HTML into lines while preserving list and break structure. */
function htmlLines(source, width, measure, options, wrap) {
  var result = [];
  var parts = [];
  var indent = 0;
  var linePrefix = "";
  var continuationPrefix = "";
  var truncated = false;
  /** Emits the accumulated fragments and prepares the next line prefix. */
  var flush = (last, force = false) => {
    // lines() trims every line it emits; keep trailing spaces out of the
    // measured width so alignment and justification stay correct.
    while (wrap !== "clip" && parts.length) {
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
    });
    parts = [];
    if (!last) linePrefix = continuationPrefix;
  };

  source.forEach((sourcePart) => {
    var listMarker = false;
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
    String(sourcePart.value)
      .split(/(\n)/)
      .forEach((fragment) => {
        if (!fragment) return;
        if (fragment === "\n") {
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
          word = linePrefix + word;
          linePrefix = "";
          var candidate = [
            ...parts,
            {
              text: word,
              styles: sourcePart.styles,
              marker: listMarker,
            },
          ];
          var breakBefore =
            parts.length &&
            (endsWithBreakableSpace(parts[parts.length - 1].text) ||
              startsWithBreakableSpace(word));
          if (
            width &&
            breakBefore &&
            htmlPartsWidth(candidate, measure, options) > width
          ) {
            if (wrap === "auto" || wrap === true) {
              flush(false);
              if (!hasText(word)) return;
              word = linePrefix + word;
              linePrefix = "";
            } else if (wrap === "ellipsis") {
              ellipsizeHtmlParts(parts, width, measure, options);
              truncated = true;
              return;
            } else if (wrap !== "clip") {
              truncated = true;
              return;
            }
          }
          if (!parts.length && !hasText(word)) return;
          parts.push({
            text: word,
            styles: sourcePart.styles,
            marker: listMarker,
          });
        });
      });
  });
  if (parts.length || !result.length) flush(true, !result.length);
  return result;
}

/** Truncates styled fragments in place until an ellipsis fits the width. */
function ellipsizeHtmlParts(parts, width, measure, options) {
  var suffix = "...";
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

function ellipsize(value, width, measure, options) {
  var suffix = "...";
  var result = trimBreakableEnd(value);
  while (
    result.length &&
    measure(result + suffix, options).width +
      charSpacing(result + suffix, options.charSpace) >
      width
  ) {
    result = trimBreakableEnd(result.slice(0, -1));
  }
  return result + suffix;
}

function clipEntries(entries, availableHeight, lineHeight) {
  var linesWritten = Math.max(0, Math.floor(availableHeight / lineHeight));
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

/** Creates Recipe text measurement, layout, and drawing methods. */
export function createTextMethods({ drawText, measure, module }) {
  function dimensions(recipe, value, options = {}) {
    var result = measure.call(recipe, String(value), options);
    result.width += charSpacing(value, options.charSpace);
    result.xMax += charSpacing(value, options.charSpace);
    return result;
  }

  /** Runs drawing inside the requested rotation and skew graphics state. */
  function withTextTransform(recipe, options, callback) {
    if (!options.rotation && !options.skewX && !options.skewY) {
      callback();
      return;
    }
    recipe._save();
    if (options.rotation) {
      var origin = options.rotationOrigin || [0, 0];
      recipe.rotateContent(options.rotation, origin[0], origin[1]);
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

  /** Writes link bounds transformed and clipped with their associated text. */
  function transformedLink(recipe, url, x, y, width, height, options, clip) {
    if (!options.rotation && !options.skewX && !options.skewY) {
      if (clip) {
        var clippedRight = Math.min(x + width, clip.x + clip.width);
        var clippedBottom = Math.min(y + height, clip.y + clip.height);
        x = Math.max(x, clip.x);
        y = Math.max(y, clip.y);
        width = clippedRight - x;
        height = clippedBottom - y;
        if (width <= 0 || height <= 0) return;
      }
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
        return [
          pdfOrigin.nx + cosine * offsetX - sine * offsetY,
          pdfOrigin.ny + sine * offsetX + cosine * offsetY,
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

  var textMarkupSubtypes = {
    highlight: "Highlight",
    underline: "Underline",
    strikeOut: "StrikeOut",
    squiggly: "Squiggly",
  };

  /**
   * Adds the text-markup annotations requested by text() options over one
   * drawn line. Only the outer text() options request annotations; HTML
   * `<u>` and `<s>` styles stay visual decoration, as in native Recipe.
   * An optional clip rectangle limits the annotation to visible line bounds.
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
      bounds ||= dimensions(
        recipe,
        "ABCDEFGHIJKLMNOPQRSTUVWXYZgjpqy|}",
        options,
      );
      var left = x;
      var right = x + width;
      var top = baseline - bounds.yMax;
      var bottom = baseline - bounds.yMin;
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
        height: clip ? bottom - top : bounds.yMax - bounds.yMin,
      };
      Object.keys(annotation).forEach((name) => {
        if (annotation[name] === undefined) delete annotation[name];
      });
      // annot() anchors the box at its bottom edge, the line's descent.
      if (validateOnly) {
        recipe._flushAnnotations(true, [
          {
            x: left,
            y: bottom,
            subtype,
            options: annotation,
          },
        ]);
      } else {
        recipe.annot(left, bottom, subtype, annotation);
      }
    });
  }

  /** Draws a highlight rectangle using the same transform as its text. */
  function drawHilite(recipe, x, y, width, height, options, hilite) {
    withTextTransform(recipe, options, () => {
      recipe.rectangle(x, y, width, height, {
        fill: hilite.color || "#ffff00",
        opacity: hilite.opacity ?? 0.5,
      });
    });
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
     * @throws {Error} If the requested font is not registered or cannot be loaded.
     */
    textDimensions(value, options = {}) {
      return dimensions(this, value, {
        ...options,
        fontSize: options.fontSize || options.size || 14,
      });
    },

    /**
     * Measures the height required by an internal text box.
     * @private
     */
    _measureTextBoxHeight(value, options = {}) {
      var box = options.textBox || options.cell || {};
      var [top, right, bottom, left] = padding(box.padding);
      var fontSize = options.fontSize || options.size || 14;
      var width = box.width || 0;
      var lineHeight =
        box.lineHeight ||
        dimensions(this, "ABCDEFGHIJKLMNOPQRSTUVWXYZgjpqy|}", {
          ...options,
          fontSize,
        }).height;
      var availableWidth = width ? width - left - right : 0;
      var textOptions = { ...options, fontSize };
      /** Measures a fragment with the current Recipe font state. */
      var measureText = (text, partOptions) =>
        dimensions(this, text, partOptions);
      var entries = options.html
        ? htmlLines(
            htmlToTextObjects(value, options),
            availableWidth,
            measureText,
            textOptions,
            box.wrap === false ? "ellipsis" : box.wrap || "auto",
          )
        : lines(
            value,
            availableWidth,
            measureText,
            textOptions,
            box.wrap === false ? "ellipsis" : box.wrap || "auto",
          );
      return Math.max(
        box.minHeight || 0,
        entries.length * lineHeight + top + bottom,
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
     * @name movedown
     * @function
     * @memberof Recipe#
     * @param {number} [count=1] - Number of line heights to move.
     * @param {boolean} [returnCoords=false] - Return the new coordinates instead of the Recipe instance.
     * @returns {Recipe|RecipePosition} The Recipe instance, or the new `[x, y]` coordinates.
     */
    movedown(count = 1, returnCoords = false) {
      this._cursor.x = this._textBoxOrigin?.x ?? this._cursor.x;
      this._cursor.y += count * (this._lastLineHeight || 14);
      return returnCoords ? [this._cursor.x, this._cursor.y] : this;
    },

    /**
     * Draws text on the active page and advances the Recipe text cursor.
     * Explicit x and y values are PDF points in Recipe's top-left coordinate
     * system, where x increases rightward and y increases downward. When they
     * are omitted, drawing starts at the cursor or margins. Text boxes, flow,
     * HTML styling, links, highlighting, clipping, and named layouts are
     * controlled by `RecipeTextOptions`.
     *
     * @name text
     * @function
     * @memberof Recipe#
     * @param {string} [value=''] - Text or supported HTML source to draw.
     * @param {number|RecipeTextOptions} [x] - Left coordinate, or options when coordinates are omitted.
     * @param {number} [y] - Top coordinate.
     * @param {RecipeTextOptions} [options] - Text and layout options.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If a requested overflow layout is undefined, text clipping cannot be applied, or a requested font cannot be loaded.
     */
    text(value = "", x, y, options = {}) {
      if (typeof x === "object" || x === undefined) {
        options = x || {};
        x = this._cursor.x || this._margin.left;
        y = this._cursor.y || this._margin.top;
      }
      var inherited = options.flow ? this._textOptions || {} : {};
      options = merge(inherited, options);
      var box = options.textBox || options.cell || {};
      var [top, right, bottom, left] = padding(box.padding);
      var layout = options.layout && this._layouts?.[options.layout];
      var column = layout?.[0];
      if (column) {
        x = column.x;
        y = column.y;
        box = merge(box, { width: column.width, height: column.height });
      }
      var fontSize = options.fontSize || options.size || 14;
      var width =
        box.width ||
        (options.flow ? this._pageWidth - x - this._margin.right : 0);
      // Validate every requested markup option before drawing any part of
      // this text call, so a later invalid subtype cannot leave partial output.
      addTextMarkup(this, { ...options, fontSize }, x, y, 1, true);
      var wrap = box.wrap === false ? "ellipsis" : box.wrap || "auto";
      var measureText = (text, textOptions) =>
        dimensions(this, text, textOptions);
      var source = options.html ? htmlToTextObjects(value, options) : null;
      var entries = options.html
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
      var lineHeight =
        box.lineHeight ||
        dimensions(this, "ABCDEFGHIJKLMNOPQRSTUVWXYZgjpqy|}", {
          ...options,
          fontSize,
        }).height;
      if (box.onClip && !box.clipIfExceedsBox) {
        console.warn(
          "textBox.onClip will not be called unless textBox.clipIfExceedsBox is true.",
        );
      }
      var clipResult;
      if (box.clipIfExceedsBox && box.height !== undefined && !options.flow) {
        var clipped = clipEntries(
          entries,
          box.height - top - bottom,
          lineHeight,
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
        entries.length * lineHeight + top + bottom,
      );
      var height = box.height || contentHeight;
      var topAlign = options.align?.split(" ") || [];
      /** Measures a line with per-fragment HTML styles when present. */
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
      if (topAlign[0] === "center") x -= naturalWidth / 2;
      else if (topAlign[0] === "right") x -= naturalWidth;
      if (topAlign[1] === "center") y -= height / 2;
      else if (topAlign[1] === "bottom") y -= height;
      if (box.style)
        this.rectangle(
          x,
          y,
          width || widestEntry + left + right,
          height,
          box.style,
        );
      var vertical = box.textAlign?.split(" ")[1];
      var currentY =
        y +
        top +
        (vertical === "center"
          ? (height - contentHeight) / 2
          : vertical === "bottom"
            ? height - contentHeight
            : 0);
      var columnIndex = 0;
      entries.some((entry, index) => {
        if (
          layout &&
          currentY + lineHeight >
            layout[columnIndex].y + layout[columnIndex].height
        ) {
          columnIndex++;
          if (columnIndex === layout.length) {
            var order = options.overflow?.(this);
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
        var textOptions = { ...options, ...entry.styles, fontSize };
        var textWidth = entry.parts
          ? htmlPartsWidth(
              entry.parts,
              (text, partOptions) => dimensions(this, text, partOptions),
              { ...options, fontSize },
            )
          : dimensions(this, entry.text, textOptions).width;
        var horizontal = box.textAlign?.split(" ")[0];
        var drawX =
          x +
          left +
          (horizontal === "center"
            ? (width - left - right - textWidth) / 2
            : horizontal === "right"
              ? width - right - textWidth
              : 0);
        var baseline = currentY + lineHeight;
        if (textOptions.rotation && !textOptions.rotationOrigin) {
          textOptions.rotationOrigin = [drawX, baseline];
        }
        var linkX = drawX;
        var linkWidth = textWidth;
        var clipping = wrap === "clip" && width;
        var clip = clipping
          ? {
              x: x + left,
              y: currentY,
              width: width - left - right,
              height: lineHeight,
            }
          : undefined;
        if (clipping) {
          var clipPoint = this._calibrateCoordinate(
            x + left,
            currentY,
            0,
            -lineHeight,
          );
          this._save();
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
        }
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
          var justify = horizontal === "justify" && !entry.last && width;
          var drawParts = justify ? entry.parts : groupedHtmlParts(entry.parts);
          /** Reports whether this fragment owns an expandable justification gap. */
          var hasGapAfter = (part, index) =>
            justify &&
            !part.marker &&
            endsWithBreakableSpace(part.text) &&
            drawParts.slice(index + 1).some((next) => hasText(next.text));
          var partGaps = drawParts.filter(hasGapAfter).length;
          var drawnWidth = justify
            ? htmlPartsWidth(
                drawParts,
                (text, partOptions) => dimensions(this, text, partOptions),
                { ...options, fontSize },
                false,
              )
            : textWidth;
          var partGap =
            partGaps > 0 ? (width - left - right - drawnWidth) / partGaps : 0;
          var drawnText = "";
          var rotationOrigin = options.rotationOrigin || [drawX, baseline];
          drawParts.forEach((part, partIndex) => {
            var partOptions = { ...options, ...part.styles, fontSize };
            if (partOptions.rotation && !partOptions.rotationOrigin) {
              partOptions.rotationOrigin = rotationOrigin;
            }
            drawX += boundaryCharSpacing(
              drawnText,
              part.text,
              partOptions.charSpace,
            );
            var partWidth = dimensions(this, part.text, partOptions).width;
            if (partOptions.hilite) {
              var partHilite =
                typeof partOptions.hilite === "object"
                  ? partOptions.hilite
                  : {};
              var partBounds = dimensions(this, part.text, partOptions);
              var partHiliteBounds = partBounds.height
                ? partBounds
                : dimensions(
                    this,
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZgjpqy|}",
                    partOptions,
                  );
              drawHilite(
                this,
                drawX + partHiliteBounds.xMin,
                baseline - partHiliteBounds.yMax,
                partWidth + (hasGapAfter(part, partIndex) ? partGap : 0),
                partHiliteBounds.yMax - partHiliteBounds.yMin,
                partOptions,
                partHilite,
              );
            }
            drawText.call(this, part.text, drawX, baseline, partOptions);
            if (partOptions.link) {
              var linkBounds = dimensions(this, part.text, partOptions);
              var coversGap =
                hasGapAfter(part, partIndex) &&
                drawParts
                  .slice(partIndex + 1)
                  .find((next) => hasText(next.text))?.styles.link ===
                  partOptions.link;
              var partLinkX = drawX + linkBounds.xMin;
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
            drawX += partWidth;
            if (hasGapAfter(part, partIndex)) drawX += partGap;
            drawnText += part.text;
          });
          linkWidth = drawX - linkX;
        } else if (horizontal === "justify" && !entry.last && width) {
          var words = entry.text.match(/\S+\s*/g) || [entry.text];
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
          drawText.call(this, entry.text, drawX, baseline, textOptions);
        }
        if (clipping) this._restore();
        addTextMarkup(
          this,
          { ...options, fontSize },
          linkX,
          baseline,
          hasText(entry.text) ? linkWidth : 0,
          false,
          clip,
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
        currentY += lineHeight;
        return false;
      });
      this._lastLineHeight = lineHeight;
      this._cursor = { x, y: currentY };
      this._textBoxOrigin = { x, y };
      this._textOptions = options.flow ? options : null;
      if (clipResult && typeof box.onClip === "function") {
        box.onClip(this, clipResult);
      }
      return this;
    },
  };
}
