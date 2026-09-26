import { RecipeLineCap, RecipeTableRowParity } from "../value-sets.js";
/** Reports whether a style value is a plain object whose keys can merge. */
function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  var prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Merges nested text styles like native Recipe without mutating either side.
 * Plain objects merge key by key; arrays and other values replace.
 */
function merge(left = {}, right = {}) {
  var result = { ...left };
  for (var key of Object.keys(right)) {
    var value = right[key];
    result[key] = Array.isArray(value)
      ? value.slice()
      : isPlainObject(value)
        ? merge(isPlainObject(result[key]) ? result[key] : {}, value)
        : value;
  }
  return result;
}

/** Converts a row or header style's `cell` into its text box, like native. */
function cellOptions(options = {}, name = "cell") {
  var result = { ...options };
  if (result[name]) {
    // Native replaces the style's textBox with its cell rather than merging.
    result.textBox = result[name];
    delete result[name];
  }
  return result;
}

/** Keeps table-level text options; native ignores a table-level `cell`. */
function tableTextOptions(options) {
  var result = { ...options };
  delete result.cell;
  return result;
}

/** Uses a column's `cell` as its only body text box, like native columns. */
function columnCellOptions(options) {
  var result = { ...options, textBox: { ...options.cell } };
  delete result.cell;
  return result;
}

/**
 * Resolves the table's data fields: `order` when given, otherwise the names
 * of the configured `columns`, otherwise every field found in any record, in
 * first-seen order.
 */
function tableFields(contents, options) {
  if (options.order?.length) {
    return typeof options.order === "string"
      ? options.order
          .split(",")
          .map((field) => field.trim())
          .filter(Boolean)
      : options.order.slice();
  }
  if (options.columns?.length)
    return options.columns.map((column) => column.name);
  var fields = [];
  contents.forEach((record) =>
    Object.keys(record || {}).forEach((field) => {
      if (!fields.includes(field)) fields.push(field);
    }),
  );
  return fields;
}

/** Creates Recipe table layout methods. */
export function createTableMethods() {
  return {
    /**
     * Draws records as a table on the active page.
     * x and y are PDF points in Recipe's top-left coordinate system, where x
     * increases rightward and y increases downward. Columns follow `order`,
     * then the configured `columns`, then every field found in any record.
     * Missing and nullish values render as empty cells. Rows are measured
     * with their final cell options, including renderer results, before
     * drawing; each renderer runs once per cell. Optional overflow handling
     * can continue at another Recipe position, and the cursor finishes at the
     * table's left edge and bottom. Empty contents or no selected columns leave
     * the Recipe unchanged. Array-form order preserves exact field names.
     * Measurements include padding, minimum heights, fixed heights, and HTML
     * layout. Overflow callbacks receive the Recipe as `this` and the first
     * argument; rows are not split across continuation areas.
     * Header text styles are independent of body styles: column header options
     * (or defaults) are overridden by table header options, then alignToData
     * and column hcell box overrides are applied, matching native Recipe.
     *
     * @name table
     * @function
     * @memberof Recipe#
     * @param {number} x - Left table coordinate.
     * @param {number} y - Top table coordinate.
     * @param {RecipeTableRow[]} contents - Records to render as rows.
     * @param {RecipeTableOptions} [options] - Column, row, header, border, text, and overflow options.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If table text cannot be measured or drawn, including when a requested font cannot be loaded.
     * @throws {RangeError} If an overflow callback continues into an area too small for the pending row and its repeated header. Return true to stop, or provide enough space; the callback is called once per overflow.
     * @throws {Error} If an overflow callback continues after ending the page without starting another one.
     */
    table(x, y, contents, options = {}) {
      if (!Array.isArray(contents) || !contents.length) return this;
      var definitions = tableFields(contents, options).map(
        (field) =>
          options.columns?.find((column) => column.name === field) || {
            name: field,
            text: field,
          },
      );
      if (!definitions.length) return this;
      this.layout("_table_", x, y, 0, options.height || 0, {
        columns: definitions,
        reset: true,
      });
      var columns = this._layouts._table_;
      var tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
      /** Bounds are recomputed for every continuation position and page. */
      var segmentBottom = (top) =>
        options.height
          ? Math.min(
              top + options.height,
              this._pageHeight - this._margin.bottom,
            )
          : this._pageHeight - this._margin.bottom;
      var bottom = segmentBottom(y);
      var currentY = y,
        tableTop = y,
        lines = [],
        first = true;
      var headerHeight = 0;
      /** Draws each completed segment once, including an overflow stop. */
      var drawBorder = () => {
        // A segment without rows has nothing to enclose.
        if (!options.border || currentY === tableTop) return;
        var border = {
          ...(options.border === true ? {} : options.border),
          // Keep borders from extending outside of the enclosing box.
          lineCap: RecipeLineCap.BUTT,
        };
        if (!border.width) border.width = 0.5;
        this.rectangle(x, tableTop, tableWidth, currentY - tableTop, border);
        columns
          .slice(0, -1)
          .forEach((column) =>
            this.line(
              column.x + column.width,
              tableTop,
              column.x + column.width,
              currentY,
              border,
            ),
          );
        // The last row line is the rectangle's bottom edge.
        lines
          .slice(0, -1)
          .forEach((line) => this.line(x, line, x + tableWidth, line, border));
        tableTop = currentY;
        lines = [];
      };
      /** Applies native's 2pt default cell padding unless one is set. */
      var paddedCell = (cellOptionsValue) =>
        cellOptionsValue.textBox?.padding === undefined
          ? merge(cellOptionsValue, { textBox: { padding: 2 } })
          : cellOptionsValue;
      /** Resolves header styles identically for measurement and drawing. */
      var headerOptions = (column) => {
        var header = merge(
          { textBox: {} },
          column.options.header && typeof column.options.header === "object"
            ? column.options.header
            : {
                bold: true,
                textBox: { padding: 2, textAlign: "center center" },
              },
        );
        if (typeof options.header === "object") {
          var overrides = { ...options.header };
          // Native's table header.cell replaces the same override's textBox.
          if (overrides.cell) {
            overrides.textBox = overrides.cell;
            delete overrides.cell;
          }
          header = merge(header, overrides);
        }
        if (options.header?.alignToData && column.options.cell?.textAlign) {
          header.textBox.textAlign = column.options.cell.textAlign;
        }
        if (column.options.hcell) {
          header.textBox = merge(header.textBox, column.options.hcell);
        }
        return header;
      };
      /** Writes a repeated header at the current segment's top. */
      var writeHeader = () => {
        if (!options.header) return;
        columns.forEach((column) => {
          this.text(
            column.text,
            column.x,
            currentY,
            merge(headerOptions(column), {
              textBox: { width: column.width, minHeight: headerHeight },
            }),
          );
        });
        currentY += headerHeight;
        lines.push(currentY);
      };
      if (options.header) {
        headerHeight = Math.max(
          ...columns.map((column) =>
            this._measureTextBoxHeight(
              column.text,
              merge(headerOptions(column), {
                textBox: { width: column.width },
              }),
            ),
          ),
        );
      }
      var tableX = x;
      for (var row = 0; row < contents.length; row += 1) {
        var record = contents[row];
        var rowOptions =
          options.row &&
          (!options.row.nth ||
            (options.row.nth === RecipeTableRowParity.EVEN &&
              (row + 1) % 2 === 0) ||
            (options.row.nth === RecipeTableRowParity.ODD && (row + 1) % 2))
            ? options.row
            : {};
        // Resolve every cell once: the renderer runs once per cell, and its
        // options size the row as well as style the drawn text.
        var cells = columns.map((column) => {
          var text = Object.prototype.hasOwnProperty.call(record, column.field)
            ? (record[column.field] ?? "")
            : "";
          var rendered =
            column.options.renderer?.(text, record, column.field, row + 1) ||
            {};
          // The table callback is not a text-flow overflow callback, and
          // native ignores a table-level cell rather than boxing every cell.
          var { overflow: _tableOverflow, ...tableCellOptions } =
            tableTextOptions(options);
          return {
            column,
            text: String(text),
            options: merge(
              merge(
                merge(
                  tableCellOptions,
                  paddedCell(columnCellOptions(column.options)),
                ),
                cellOptions(rowOptions),
              ),
              rendered,
            ),
          };
        });
        var height = Math.max(
          ...cells.map((cell) =>
            this._measureTextBoxHeight(
              cell.text,
              merge(cell.options, { textBox: { width: cell.column.width } }),
            ),
          ),
        );
        // A continuation must reserve room for its repeated header and row.
        var needed = height + (first && options.header ? headerHeight : 0);
        if (options.overflow && currentY + needed > bottom) {
          drawBorder();
          var order = options.overflow.call(this, this, row + 1);
          if (order === true) break;
          if (!this._pageHeight)
            throw new Error(
              "Recipe.table: the overflow callback must leave an active page to continue on.",
            );
          if (order?.position) {
            [x, y] = order.position;
            var columnX = x;
            columns.forEach((column) => {
              column.x = columnX;
              columnX += column.width;
            });
          }
          tableX = x;
          currentY = tableTop = y;
          bottom = segmentBottom(y);
          lines = [];
          first = true;
          if (currentY + height + headerHeight > bottom) {
            throw new RangeError(
              `Recipe.table: row ${row + 1} and its header do not fit in the continuation area.`,
            );
          }
        }
        if (first) {
          writeHeader();
          first = false;
        }
        cells.forEach((cell) => {
          this.text(
            cell.text,
            cell.column.x,
            currentY,
            merge(cell.options, {
              textBox: { width: cell.column.width, minHeight: height },
            }),
          );
        });
        currentY += height;
        lines.push(currentY);
      }
      drawBorder();
      // Leave the text cursor at the table's left edge, below its last segment.
      this._textCursor = { x: tableX, y: currentY };
      this._textBoxOrigin = { x: tableX, y: currentY };
      return this;
    },
  };
}
