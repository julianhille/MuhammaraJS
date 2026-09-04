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
/** Creates Recipe table layout methods. */
export function createTableMethods() {
  return {
    table(x, y, contents, options = {}) {
      if (!Array.isArray(contents) || !contents.length) return this;
      var fields = options.order
        ? typeof options.order === "string"
          ? options.order.split(",")
          : options.order
        : options.columns?.map((column) => column.name) ||
          Object.keys(contents[0]);
      var definitions = fields.map(
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
      var bottom = options.height
        ? y + options.height
        : this._pageHeight - this._margin.bottom;
      var currentY = y,
        tableTop = y,
        lines = [],
        first = true;
      var headerHeight = 0;
      var drawBorder = () => {
        if (!options.border || currentY === tableTop) return;
        var border =
          options.border === true
            ? { width: 0.5 }
            : { width: 0.5, ...options.border };
        this.rectangle(x, tableTop, tableWidth, currentY - tableTop, {
          stroke: border.stroke || border.color,
          lineWidth: border.width,
        });
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
        lines.forEach((line) =>
          this.line(x, line, x + tableWidth, line, border),
        );
      };
      var writeHeader = () => {
        if (!options.header) return;
        columns.forEach((column) => {
          var header = headerOptions(column);
          this.text(
            column.text,
            column.x,
            currentY,
            merge(merge(options, header), {
              textBox: { width: column.width, minHeight: headerHeight },
            }),
          );
        });
        currentY += headerHeight;
        lines.push(currentY);
      };
      var headerOptions = (column) => {
        var header = merge(
          column.options.header || {
            bold: true,
            textBox: { textAlign: "center center" },
          },
          options.header === true ? {} : cellOptions(options.header),
        );
        if (options.header?.alignToData && column.options.textBox?.textAlign) {
          header.textBox.textAlign = column.options.textBox.textAlign;
        }
        return merge(header, cellOptions(column.options, "hcell"));
      };
      if (options.header) {
        headerHeight = Math.max(
          ...columns.map((column) =>
            this._measureTextBoxHeight(
              column.text,
              merge(merge(options, headerOptions(column)), {
                textBox: { width: column.width },
              }),
            ),
          ),
        );
      }
      var stopped = false;
      contents.forEach((record, row) => {
        if (stopped) return;
        var rowOptions =
          options.row &&
          (!options.row.nth ||
            (options.row.nth === "even" && (row + 1) % 2 === 0) ||
            (options.row.nth === "odd" && (row + 1) % 2))
            ? options.row
            : {};
        var cellOptionsFor = (column) => {
          var text = record[column.field] ?? "";
          var rendered =
            column.options.renderer?.(text, record, column.field, row + 1) ||
            {};
          return merge(
            merge(
              merge(cellOptions(options), cellOptions(column.options)),
              cellOptions(rowOptions),
            ),
            rendered,
          );
        };
        var height = Math.max(
          ...columns.map((column) =>
            this._measureTextBoxHeight(
              String(record[column.field] ?? ""),
              merge(cellOptionsFor(column), {
                textBox: { width: column.width },
              }),
            ),
          ),
        );
        // A continuation must reserve room for its repeated header and row.
        var needed = height + (first ? headerHeight : 0);
        if (currentY + needed > bottom && options.overflow) {
          drawBorder();
          var order = options.overflow(this, row + 1);
          if (order === true) {
            stopped = true;
            return;
          }
          [x, y] = order?.position || [x, y];
          columns.forEach((column) => {
            column.x = x;
            x += column.width;
          });
          currentY = tableTop = y;
          bottom = options.height
            ? y + options.height
            : this._pageHeight - this._margin.bottom;
          lines = [];
          first = true;
        }
        if (first) {
          writeHeader();
          first = false;
        }
        columns.forEach((column) => {
          var text = record[column.field] ?? "";
          this.text(
            String(text),
            column.x,
            currentY,
            merge(cellOptionsFor(column), {
              textBox: { width: column.width, minHeight: height },
            }),
          );
        });
        currentY += height;
        lines.push(currentY);
      });
      drawBorder();
      this._cursor = { x, y: currentY };
      return this;
    },
  };
}
