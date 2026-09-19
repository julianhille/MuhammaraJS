var { htmlToTextObjects } = require("./htmlToTextObjects");

/** Copies serializable table styling before resolving cell overrides. */
function clone(object) {
  return JSON.parse(JSON.stringify(object));
}

/** Converts a table cell style into text options. */
function getCellOptions(options, cell = "cell") {
  var cellOptions = clone(options);

  if (cellOptions[cell]) {
    // convert cell options to textBox options
    cellOptions.textBox = cellOptions[cell];
    delete cellOptions[cell];
  }
  return cellOptions;
}

/** Measures the same text and outer box height that text() will draw. */
function getCellHeight(self, text, column, options) {
  var colOptions = self._merge(options, { textBox: { width: column.width } });
  var originCoord = self._calibrateCoordinate(
    column.x,
    column.y,
    0,
    0,
    self.pageNumber,
  );
  var pathOptions = self._getPathOptions(
    colOptions,
    originCoord.nx,
    originCoord.ny,
  );
  pathOptions.html = colOptions.html;
  var textObjects = colOptions.html
    ? htmlToTextObjects(text, colOptions)
    : self._makeTextObject(text, pathOptions.size, colOptions);
  var textBox = self._makeTextBox(colOptions);
  var { textHeight } = self._layoutText(textObjects, textBox, pathOptions);

  return (
    textBox.height ||
    Math.max(
      textBox.minHeight,
      textHeight + textBox.paddingTop + textBox.paddingBottom,
    )
  );
}

/** Draws a completed table segment without duplicating its bottom edge. */
function drawTableBorder(self, x, y, width, height, rowLines, options) {
  // A segment without rows has nothing to enclose.
  if (!options.border || height <= 0) {
    return;
  }
  var borderOptions = Object.assign(
    {},
    options.border === true ? {} : options.border,
    // Keep borders from extending outside of the enclosing box.
    { lineCap: "butt" },
  );
  if (!borderOptions.width) {
    borderOptions.width = 0.5;
  }

  self.rectangle(x, y, width, height, borderOptions);
  var columns = self._layouts["_table_"];

  // Draw verticals
  for (var index = 0; index < columns.length - 1; index++) {
    var column = columns[index];
    self.line(
      [
        [column.x + column.width, y],
        [column.x + column.width, y + height],
      ],
      borderOptions,
    );
  }
  // Draw horizontals; the last row line is the rectangle's bottom edge.
  for (var index = 0; index < rowLines.length - 1; index++) {
    var yPos = rowLines[index];
    self.line(
      [
        [x, yPos],
        [x + width, yPos],
      ],
      borderOptions,
    );
  }
}

/**
 * Resolves the table's data fields: `order` when given, otherwise the names
 * of the configured `columns`, otherwise every field found in any record, in
 * first-seen order.
 * @private
 */
function tableFields(contents, options) {
  if (options.order && options.order.length) {
    return typeof options.order === "string"
      ? options.order
          .split(",")
          .map((field) => field.trim())
          .filter(Boolean)
      : options.order.slice();
  }
  if (options.columns && options.columns.length) {
    return options.columns.map((column) => column.name);
  }
  var fields = [];
  for (var record of contents) {
    for (var field of Object.keys(record || {})) {
      if (!fields.includes(field)) {
        fields.push(field);
      }
    }
  }
  return fields;
}

/**
 * Display text data in tabular form
 * Rows and headers use their rendered text-box heights, including padding,
 * minimum heights, fixed heights, and HTML layout. Empty contents or no selected
 * columns leave the Recipe unchanged. Array-form order preserves exact keys.
 * Header text styles are independent of body styles: column header options
 * (or defaults) are overridden by table header options, then alignToData
 * and column hcell box overrides are applied.
 * @name table
 * @function
 * @memberof Recipe#
 * @param {number} x - The coordinate x used to position table on page
 * @param {number} y - The coordinate y used to position table on page
 * @param {object[]} contents - the data to be placed into the table
 * @param {object} [options] - The options
 * @param {number} [options.height] - The height designation of the table
 * @param {string|string[]} [options.order] - Defines the order of the named columns in the table.
 * It can also be used to choose a subset of the actual data found in the given contents.
 * @param {object[]} [options.columns] - Holds the defining options for columns in the table.
 * @param {string} [options.columns[].name] - The name of the content data field to be associated with the column.
 * This field is mandatory when supplying column options.
 * @param {string} [options.columns[].text] - The title to be applied to the column header.
 * When missing, the data field name is used.
 * @param {number} [options.columns[].width=100] - The width of table column.
 * @param {object} [options.columns[].cell] - Holds the options to be applied to a column table cell.
 * All textBox options from the 'text' interface can be used here.
 * @param {string|number[]} [options.columns[].color] - Text color (HexColor, PercentColor or DecimalColor)
 * @param {number} [options.columns[].opacity=1] - opacity
 * @param {string} [options.columns[].font=Helvetica] - The font. 'Arial', 'Helvetica'...
 * @param {number} [options.columns[].size=14] - The font size
 * @param {function} [options.columns[].renderer] - function to be called which can be used to modify the text options for a particular
 * table cell. The function is called with `(text, data, field, row)`, where `text` is the text to be written in the cell,
 * `data` holds the text elements in the table row, `field` is the column field, and `row` is the one-based row number. The function returns an object with the text attributes that
 * are to be modified for the table cell.
 * @param {object|boolean} [options.header=false] - When true, the column name associated with a column will
 * appear at the top of the column. When presented as an object it is the set of unique options to be applied to column headers.
 * All 'text' interface options can be used.
 * @param {object} [options.header.cell] - All textBox options from the 'text' interface can be used here.
 * @param {object|boolean} [options.border] - Used to define table and cell border characteristics
 * @param {number} [options.border.width=.5] - Thickness of lines used in the border.
 * @param {string|number[]} [options.border.stroke] - line color (HexColor, PercentColor or DecimalColor)
 * @param {function} [options.overflow] - Called when the next table entry is going to expand the table
 * beyond the given height or page boundary. Its parameters are (self, row) where 'self' is the recipe handle so
 * that other recipe interfaces can be called, and the row number of the data which caused the data overflow.
 * The callback's `this` is also the Recipe instance.
 * The return value can be 'true' which indicates that data processing should stop, or 'false' which indicates that
 * the data should continue being processed with the original [x,y] coordinates, or it can be an object containing
 * a 'position' property indicating the [x,y] coordinates where the next table for the remaining data should start.
 * @param {object} [options.row] - text properties to be applied to all cells in a table row.
 * @param {object} [options.row.cell] - All textBox options from the 'text' interface can be used here.
 * @param {string} [options.row.nth] - 'even|odd', indicating that the properties should be applied only to
 * 'even' or 'odd' rows.
 * @returns {Recipe} The recipe instance.
 * @throws {RangeError} If the overflow callback continues into an area too small
 * for the pending row and its repeated header. Return true to stop, or provide
 * enough space; rows are not split and the callback is called once per overflow.
 * @throws {Error} If the overflow callback continues after ending the page
 * without starting another one.
 */
exports.table = function table(x, y, contents, options = {}) {
  if (!Array.isArray(contents) || contents.length === 0) {
    return this;
  }
  var columns = tableFields(contents, options).map((field) => {
    var column =
      options.columns &&
      options.columns.find((definition) => definition.name === field);
    return column || { text: field, name: field };
  });
  if (columns.length === 0) {
    return this;
  }
  this.layout("_table_", x, y, 0, 0, { columns: columns, reset: true });

  var tableWidth = this._layouts["_table_"].reduce((width, column) => {
    width += column.width;
    return width;
  }, 0);

  this._previousTextObjects = [];
  var nth;
  var rowOptions = {};

  /** Resolves header styles identically for measurement and drawing. */
  var headerOptions = (column) => {
    var colOptions = clone(column.options.header);
    if (typeof options.header === "object") {
      colOptions = this._merge(colOptions, getCellOptions(options.header));
    }
    // Have header alignment match data alignment?
    if (options.header.alignToData && column.options.textBox.textAlign) {
      colOptions.textBox.textAlign = column.options.textBox.textAlign;
    }
    // Is there a specific header cell override in this column?
    if (column.options.hcell) {
      var cellOptions = getCellOptions(column.options, "hcell");
      colOptions.textBox = this._merge(
        colOptions.textBox,
        clone(cellOptions.textBox),
      );
    }
    return colOptions;
  };

  var headerHeight = 0;
  if (options.header) {
    for (var column of this._layouts["_table_"]) {
      var cellHeight = getCellHeight(
        this,
        column.text,
        column,
        headerOptions(column),
      );
      headerHeight = Math.max(headerHeight, cellHeight);
    }
  }

  /** Recomputes bounds for each continuation position and page. */
  var segmentBottom = (top) => {
    var bottom = options.height ? top + options.height : 0;
    var pageBottom =
      this.pageInfo(this.pageNumber).height - this._margin.bottom;
    if (bottom === 0 || bottom > pageBottom) {
      bottom = pageBottom;
    }
    return bottom;
  };

  if (options.row) {
    rowOptions = getCellOptions(options.row);

    switch (options.row.nth) {
      case "even":
        nth = (row) => {
          return row % 2 === 0;
        };
        break;
      case "odd":
        nth = (row) => {
          return row % 2 !== 0;
        };
        break;
      default: // apply to all rows
        nth = () => {
          return 1;
        };
        break;
    }
  }

  var tableBottom = options.overflow ? segmentBottom(y) : 0;
  var tableHeight = 0;
  var rowLines = [];
  var currentY = y;
  var firstTime = true;
  var row = 0;

  for (var record of contents) {
    row++;

    // Resolve every cell once: the renderer runs once per cell, and its
    // options size the row as well as style the drawn text.
    var cells = this._layouts["_table_"].map((column) => {
      var field = column.field;
      var value = record[field];
      var text = value === undefined || value === null ? "" : value;
      var colOptions = clone(options);
      colOptions = this._merge(colOptions, clone(column.options));
      if (nth && nth(row)) {
        colOptions = this._merge(colOptions, clone(rowOptions));
      }
      if (column.options.renderer) {
        var renderOptions = column.options.renderer(text, record, field, row);
        if (renderOptions) {
          colOptions = this._merge(colOptions, renderOptions);
        }
      }
      return { column, text: String(text), options: colOptions };
    });

    var rowHeight = 0;
    for (var cell of cells) {
      var cellHeight = getCellHeight(
        this,
        cell.text,
        cell.column,
        cell.options,
      );
      rowHeight = Math.max(rowHeight, cellHeight);
    }

    // When table gets 'full', let user know when overflow callback provided.
    // They can choose to bail out of table filling loop, or keep on going with
    // appropriate variables reset to initial values. This gives the user the
    // opportunity to change to a new page to continue table production with
    // remaining rows of data. A continuation reserves room for its repeated
    // header as well as the row.
    var needed = rowHeight + (firstTime && options.header ? headerHeight : 0);
    if (options.overflow && currentY + needed > tableBottom) {
      drawTableBorder(this, x, y, tableWidth, tableHeight, rowLines, options);

      var orders = options.overflow.call(this, this, row);

      if (orders === true) {
        // stop processing table data
        tableHeight = 0;
        break;
      }
      if (!this.page) {
        throw new Error(
          "Recipe.table: the overflow callback must leave an active page to continue on.",
        );
      }
      if (orders && orders.position) {
        [x, y] = orders.position;
        var xx = x;
        // Make sure x position adjusted in all columns
        for (var column of this._layouts["_table_"]) {
          column.x = xx;
          xx += column.width;
        }
      }

      firstTime = true;
      currentY = y;
      tableHeight = 0;
      rowLines = [];
      tableBottom = segmentBottom(y);
      if (currentY + rowHeight + headerHeight > tableBottom) {
        throw new RangeError(
          `Recipe.table: row ${row} and its header do not fit in the continuation area.`,
        );
      }
    }

    if (firstTime && options.header) {
      // Display table header
      for (var column of this._layouts["_table_"]) {
        var colOptions = this._merge(headerOptions(column), {
          textBox: { minHeight: headerHeight, width: column.width },
        });
        this.text(column.text, column.x, currentY, colOptions);
      }

      currentY += headerHeight;
      tableHeight += headerHeight;
      rowLines.push(y + tableHeight);
    }

    firstTime = false;

    // Now write out table cells for current record
    for (var cell of cells) {
      var colOptions = this._merge(cell.options, {
        textBox: { minHeight: rowHeight, width: cell.column.width },
      });
      this.text(cell.text, cell.column.x, currentY, colOptions);
    }

    currentY += rowHeight;
    tableHeight += rowHeight;
    rowLines.push(y + tableHeight);
  }

  drawTableBorder(this, x, y, tableWidth, tableHeight, rowLines, options);

  // Leave the text cursor at the table's left edge, below its last segment.
  this.x = x;
  this.y = currentY;
  this.box = { x, y: currentY };
  this._flow = false;
  this._previousTextObjects = [];

  return this;
};
