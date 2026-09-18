function merge(left = {}, right = {}) {
  return {
    ...left,
    ...right,
    textBox: { ...left.textBox, ...right.textBox },
  };
}

function cellOptions(options = {}, name = "cell") {
  var result = { ...options };
  if (result[name]) {
    result.textBox = { ...result.textBox, ...result[name] };
    delete result[name];
  }
  return result;
}
/**
 * Resolves the table's data fields: `order` when given, otherwise the names
 * of the configured `columns`, otherwise every field found in any record, in
 * first-seen order.
 */
function tableFields(contents, options) {
  if (options.order?.length) {
    var order =
      typeof options.order === "string"
        ? options.order.split(",")
        : options.order;
    return order.map((field) => String(field).trim()).filter(Boolean);
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
     * table's left edge and bottom. Empty contents leave the Recipe unchanged.
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
      var drawBorder = () => {
        // A segment without rows has nothing to enclose.
        if (!options.border || currentY === tableTop) return;
        var border = {
          ...(options.border === true ? {} : options.border),
          // Keep borders from extending outside of the enclosing box.
          lineCap: "butt",
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
      };
      /** Applies native's 2pt default cell padding unless one is set. */
      var paddedCell = (cellOptionsValue) =>
        cellOptionsValue.textBox?.padding === undefined
          ? merge(cellOptionsValue, { textBox: { padding: 2 } })
          : cellOptionsValue;
      var headerOptions = (column) => {
        var header = merge(
          column.options.header && typeof column.options.header === "object"
            ? column.options.header
            : {
                bold: true,
                textBox: { padding: 2, textAlign: "center center" },
              },
          options.header === true ? {} : cellOptions(options.header),
        );
        var dataCell = paddedCell(cellOptions(column.options));
        if (options.header?.alignToData && dataCell.textBox.textAlign) {
          header.textBox.textAlign = dataCell.textBox.textAlign;
        }
        return merge(
          merge(options, header),
          cellOptions(column.options, "hcell"),
        );
      };
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
        var record = contents[row] || {};
        var rowOptions =
          options.row &&
          (!options.row.nth ||
            (options.row.nth === "even" && (row + 1) % 2 === 0) ||
            (options.row.nth === "odd" && (row + 1) % 2))
            ? options.row
            : {};
        // Resolve every cell once: the renderer runs once per cell, and its
        // options size the row as well as style the drawn text.
        var cells = columns.map((column) => {
          var text = record[column.field] ?? "";
          var rendered =
            column.options.renderer?.(text, record, column.field, row + 1) ||
            {};
          return {
            column,
            text: String(text),
            options: merge(
              merge(
                merge(
                  cellOptions(options),
                  paddedCell(cellOptions(column.options)),
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
      this._cursor = { x: tableX, y: currentY };
      this._textBoxOrigin = { x: tableX, y: currentY };
      return this;
    },
  };
}
