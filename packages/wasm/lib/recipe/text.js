import { htmlToTextObjects } from "./htmlToTextObjects.js";
import { charSpacing, Column } from "./text.helper.js";

function merge(left = {}, right = {}) {
  var result = { ...left };
  Object.entries(right).forEach(([key, value]) => {
    result[key] =
      value && typeof value === "object" && !Array.isArray(value)
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

function lines(value, width, measure, options, wrap) {
  var result = [];
  String(value)
    .split("\n")
    .forEach((paragraph) => {
      var line = "";
      var truncated = false;
      var words = paragraph.match(/\S+\s*|\s+/g) || [""];
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
          result.push({ text: line.trimEnd(), last: false });
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
          text: wrap === "clip" ? line : line.trimEnd(),
          last: true,
        });
      }
    });
  return result;
}

function ellipsize(value, width, measure, options) {
  var suffix = "...";
  var result = value.trimEnd();
  while (
    result.length &&
    measure(result + suffix, options).width +
      charSpacing(result + suffix, options.charSpace) >
      width
  ) {
    result = result.slice(0, -1).trimEnd();
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

export function createTextMethods({ drawText, measure, module }) {
  function dimensions(recipe, value, options = {}) {
    var result = measure.call(recipe, String(value), options);
    result.width += charSpacing(value, options.charSpace);
    result.xMax += charSpacing(value, options.charSpace);
    return result;
  }

  return {
    textDimensions(value, options = {}) {
      return dimensions(this, value, {
        ...options,
        fontSize: options.fontSize || options.size || 12,
      });
    },

    _measureTextBoxHeight(value, options = {}) {
      var box = options.textBox || options.cell || {};
      var [top, right, bottom, left] = padding(box.padding);
      var fontSize = options.fontSize || options.size || 12;
      var width = box.width || 0;
      var lineHeight =
        box.lineHeight ||
        dimensions(this, "ABCDEFGHIJKLMNOPQRSTUVWXYZgjpqy|}", {
          ...options,
          fontSize,
        }).height;
      var entries = lines(
        value,
        width ? width - left - right : 0,
        (text, textOptions) => dimensions(this, text, textOptions),
        { ...options, fontSize },
        box.wrap === false ? "ellipsis" : box.wrap || "auto",
      );
      return Math.max(
        box.minHeight || 0,
        entries.length * lineHeight + top + bottom,
      );
    },

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

    movedown(count = 1, returnCoords = false) {
      this._cursor.x = this._textBoxOrigin?.x ?? this._cursor.x;
      this._cursor.y += count * (this._lastLineHeight || 14);
      return returnCoords ? [this._cursor.x, this._cursor.y] : this;
    },

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
      var fontSize = options.fontSize || options.size || 12;
      var width =
        box.width ||
        (options.flow ? this._pageWidth - x - this._margin.right : 0);
      var wrap = box.wrap === false ? "ellipsis" : box.wrap || "auto";
      var source = options.html
        ? htmlToTextObjects(value, options)
        : [{ value: String(value), styles: {} }];
      var measureText = (text, textOptions) =>
        dimensions(this, text, textOptions);
      var entries = source.flatMap((part) =>
        lines(
          part.value,
          width ? width - left - right : 0,
          measureText,
          { ...options, ...part.styles, fontSize },
          wrap,
        ).map((line) => ({ ...line, styles: part.styles })),
      );
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
      var naturalWidth =
        width ||
        Math.max(
          ...entries.map(
            (entry) => dimensions(this, entry.text, options).width,
          ),
          0,
        );
      if (topAlign[0] === "center") x -= naturalWidth / 2;
      else if (topAlign[0] === "right") x -= naturalWidth;
      if (topAlign[1] === "center") y -= height / 2;
      else if (topAlign[1] === "bottom") y -= height;
      if (box.style)
        this.rectangle(
          x,
          y,
          width ||
            Math.max(
              ...entries.map(
                (entry) => dimensions(this, entry.text, options).width,
              ),
              0,
            ) +
              left +
              right,
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
        var textWidth = dimensions(this, entry.text, textOptions).width;
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
        var clipping = wrap === "clip" && width;
        if (clipping) {
          var clipPoint = this._calibrateCoordinate(
            x + left,
            currentY,
            0,
            -lineHeight,
          );
          this.save();
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
            this.restore();
            throw new Error("Unable to clip text box");
          }
        }
        if (textOptions.hilite) {
          var hilite =
            typeof textOptions.hilite === "object" ? textOptions.hilite : {};
          var bounds = dimensions(this, entry.text, textOptions);
          this.rectangle(
            drawX + bounds.xMin,
            this._pageHeight - baseline + bounds.yMin,
            bounds.xMax - bounds.xMin,
            bounds.yMax - bounds.yMin,
            {
              useGivenCoords: true,
              fill: hilite.color || "#ffff00",
              opacity: hilite.opacity ?? 0.5,
            },
          );
        }
        if (horizontal === "justify" && !entry.last && width) {
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
        } else {
          drawText.call(this, entry.text, drawX, baseline, textOptions);
        }
        if (clipping) this.restore();
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
