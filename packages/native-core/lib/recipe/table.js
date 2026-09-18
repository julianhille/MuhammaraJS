const { htmlToTextObjects } = require("./htmlToTextObjects");

function clone(object) {
  return JSON.parse(JSON.stringify(object));
}

function getCellOptions(options, cell = "cell") {
  const cellOptions = clone(options);

  if (cellOptions[cell]) {
    // convert cell options to textBox options
    cellOptions.textBox = cellOptions[cell];
    delete cellOptions[cell];
  }
  return cellOptions;
}

function getCellHeight(self, text, column, options) {
  let colOptions = self._merge(options, { textBox: { width: column.width } });
  const originCoord = self._calibrateCoordinate(
    column.x,
    column.y,
    0,
    0,
    self.pageNumber,
  );
  const pathOptions = self._getPathOptions(
    colOptions,
    originCoord.nx,
    originCoord.ny,
  );
  // Measure HTML cells as text() lays them out, including line breaks.
  const textObjects = colOptions.html
    ? htmlToTextObjects(String(text), colOptions)
    : self._makeTextObject(text, pathOptions.size, colOptions);
  const textBox = self._makeTextBox(colOptions);
  const { textHeight } = self._layoutText(textObjects, textBox, pathOptions);

  return textHeight;
}

function drawTableBorder(self, x, y, width, height, rowLines, options) {
  // A segment without rows has nothing to enclose.
  if (!options.border || height <= 0) {
    return;
  }
  const borderOptions = Object.assign(
    {},
    options.border === true ? {} : options.border,
    // Keep borders from extending outside of the enclosing box.
    { lineCap: "butt" },
  );
  if (!borderOptions.width) {
    borderOptions.width = 0.5;
  }

  self.rectangle(x, y, width, height, borderOptions);
  const columns = self._layouts["_table_"];

  // Draw verticals
  for (let index = 0; index < columns.length - 1; index++) {
    const column = columns[index];
    self.line(
      [
        [column.x + column.width, y],
        [column.x + column.width, y + height],
      ],
      borderOptions,
    );
  }
  // Draw horizontals; the last row line is the rectangle's bottom edge.
  for (let index = 0; index < rowLines.length - 1; index++) {
    const yPos = rowLines[index];
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
    const order =
      typeof options.order === "string"
        ? options.order.split(",")
        : options.order;
    return order.map((field) => String(field).trim()).filter(Boolean);
  }
  if (options.columns && options.columns.length) {
    return options.columns.map((column) => column.name);
  }
  const fields = [];
  for (const record of contents) {
    for (const field of Object.keys(record || {})) {
      if (!fields.includes(field)) {
        fields.push(field);
      }
    }
  }
  return fields;
}

/**
 * Display text data in tabular form
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
 * The return value can be 'true' which indicates that data processing should stop, or 'false' which indicates that
 * the data should continue being processed with the original [x,y] coordinates, or it can be an object containing
 * a 'position' property indicating the [x,y] coordinates where the next table for the remaining data should start.
 * @param {object} [options.row] - text properties to be applied to all cells in a table row.
 * @param {object} [options.row.cell] - All textBox options from the 'text' interface can be used here.
 * @param {string} [options.row.nth] - 'even|odd', indicating that the properties should be applied only to
 * 'even' or 'odd' rows.
 * @returns {Recipe} The recipe instance.
 */
exports.table = function table(x, y, contents, options = {}) {
  if (!Array.isArray(contents) || contents.length === 0) {
    return this;
  }
  const columns = tableFields(contents, options).map((field) => {
    const column =
      options.columns &&
      options.columns.find((definition) => definition.name === field);
    return column || { text: field, name: field };
  });
  this.layout("_table_", x, y, 0, 0, { columns: columns, reset: true });

  const tableWidth = this._layouts["_table_"].reduce((width, column) => {
    width += column.width;
    return width;
  }, 0);

  this._previousTextObjects = [];
  let nth;
  let rowOptions = {};

  // Header cells are measured with exactly the options they are drawn with.
  const headerOptions = (column) => {
    let colOptions = clone(column.options.header);
    if (typeof options.header === "object") {
      colOptions = this._merge(colOptions, getCellOptions(options.header));
    }
    // Have header alignment match data alignment?
    if (options.header.alignToData && column.options.textBox.textAlign) {
      colOptions.textBox.textAlign = column.options.textBox.textAlign;
    }
    // Is there a specific header cell override in this column?
    if (column.options.hcell) {
      const cellOptions = getCellOptions(column.options, "hcell");
      colOptions.textBox = this._merge(
        colOptions.textBox,
        clone(cellOptions.textBox),
      );
    }
    return colOptions;
  };

  let headerHeight = 0;
  if (options.header) {
    for (const column of this._layouts["_table_"]) {
      const cellHeight = getCellHeight(
        this,
        column.text,
        column,
        headerOptions(column),
      );
      headerHeight = Math.max(headerHeight, cellHeight);
    }
  }

  // The bottom is recomputed for every continuation, so a new position or a
  // new page gets its own bounds.
  const segmentBottom = (top) => {
    let bottom = options.height ? top + options.height : 0;
    const pageBottom =
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

  let tableBottom = options.overflow ? segmentBottom(y) : 0;
  let tableHeight = 0;
  let rowLines = [];
  let currentY = y;
  let firstTime = true;
  let row = 0;

  for (const record of contents) {
    row++;

    // Resolve every cell once: the renderer runs once per cell, and its
    // options size the row as well as style the drawn text.
    const cells = this._layouts["_table_"].map((column) => {
      const field = column.field;
      const value = record[field];
      const text = value === undefined || value === null ? "" : value;
      let colOptions = clone(options);
      colOptions = this._merge(colOptions, clone(column.options));
      if (nth && nth(row)) {
        colOptions = this._merge(colOptions, clone(rowOptions));
      }
      if (column.options.renderer) {
        const renderOptions = column.options.renderer(text, record, field, row);
        if (renderOptions) {
          colOptions = this._merge(colOptions, renderOptions);
        }
      }
      return { column, text: String(text), options: colOptions };
    });

    let rowHeight = 0;
    for (const cell of cells) {
      const cellHeight = getCellHeight(
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
    const needed = rowHeight + (firstTime && options.header ? headerHeight : 0);
    if (options.overflow && currentY + needed > tableBottom) {
      drawTableBorder(this, x, y, tableWidth, tableHeight, rowLines, options);

      const orders = options.overflow(this, row);

      if (orders === true) {
        // stop processing table data
        tableHeight = 0;
        break;
      }
      if (orders && orders.position) {
        [x, y] = orders.position;
        let xx = x;
        // Make sure x position adjusted in all columns
        for (const column of this._layouts["_table_"]) {
          column.x = xx;
          xx += column.width;
        }
      }

      firstTime = true;
      currentY = y;
      tableHeight = 0;
      rowLines = [];
      tableBottom = segmentBottom(y);
    }

    if (firstTime && options.header) {
      // Display table header
      for (const column of this._layouts["_table_"]) {
        const colOptions = this._merge(headerOptions(column), {
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
    for (const cell of cells) {
      const colOptions = this._merge(cell.options, {
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
