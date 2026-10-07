var { cloneOptions, resolveFontSize, trimBreakableEnd } = require("./utils");
var { HorizontalAlign, VerticalAlign } = require("../recipe-constants");
var { drawnText, drawnGaps, spacedGaps } = require("../text-direction");

/**
 * The width character spacing adds between the characters of a text.
 * @private
 * @param {string} text - The text.
 * @param {number} charSpace - The spacing added after each character but the
 *   last, except between a right-to-left letter and the points drawn before it.
 * @param {string} [direction] - The `direction` text option.
 * @param {boolean} [drawn=false] - Whether the text is already in the order
 *   it is drawn, as a piece of a reordered line is; otherwise it is in the
 *   order it is typed.
 * @returns {number} The added width.
 */
const charSpacing = function charSpacing(text, charSpace, direction, drawn) {
  return (drawn ? drawnGaps : spacedGaps)(String(text), direction) * charSpace;
};

// Have to set up word as a constant, then export it below
// so that Line can see it. Otherwise, an error is thrown.

/**
 * A word used by Recipe text layout.
 * @name Word
 * @class
 * @memberof Recipe#
 * @param {string} word - The word, a single space measured as "o".
 * @param {Object} pathOptions - The resolved text options: font, size and charSpace.
 */
const Word = class Word {
  constructor(word, pathOptions) {
    this._value = word;
    this._pathOptions = pathOptions;
    this._last = false;
    // allows space to get an actual dimension; formatting characters that
    // reordering drops are not measured. A piece of a reordered line, marked
    // _drawn, is already as it is drawn.
    this._text =
      word === " "
        ? "o"
        : pathOptions._drawn
          ? word
          : drawnText(word, pathOptions.direction);
  }

  /**
   * @returns {string} The word text.
   */
  get value() {
    return this._value;
  }

  /**
   * The measured text box, including character spacing; cached.
   * @returns {Object} xMin, yMin, xMax, yMax, width and height.
   */
  get dimensions() {
    if (this._dimensions) {
      return this._dimensions;
    }
    this._dimensions = this._pathOptions.font.calculateTextDimensions(
      this._text,
      this._pathOptions.size,
    );
    this._dimensions.xMax += this.charSpacing;
    return this._dimensions;
  }

  /**
   * @returns {boolean} Whether this is the last word of its line.
   */
  get last() {
    return this._last;
  }

  /**
   * @returns {number} The width character spacing adds to the word.
   */
  get charSpacing() {
    return charSpacing(
      this._value,
      this._pathOptions.charSpace,
      this._pathOptions.direction,
      this._pathOptions._drawn,
    );
  }

  /**
   * Mark the word as the last of its line, trimming the spaces around it
   * but a trailing non-breaking space, and measuring it again when trimmed.
   * @param {boolean} [value=true] - Whether the word is last.
   * @returns {void}
   */
  lastWord(value = true) {
    // indicate last word in line (for justification)
    this._last = value;
    if (this._last) {
      const trimmed = trimBreakableEnd(this._value.trimStart());
      // Formatting characters that reordering drops are not measured.
      const text = this._pathOptions._drawn
        ? trimmed
        : drawnText(trimmed, this._pathOptions.direction);
      this._value = trimmed;
      if (text === this._text) return;
      this._text = text;
      this._dimensions = this._pathOptions.font.calculateTextDimensions(
        this._text,
        this._pathOptions.size,
      );
      this._dimensions.xMax += this.charSpacing;
    }
  }
};

/**
 * A word used by Recipe text layout.
 * @name Word
 * @class
 * @memberof Recipe#
 * @param {string} word - The word value.
 * @param {Object} pathOptions - The resolved text options.
 */
exports.Word = Word; // ... now export Word to the rest of the library.

/**
 * A line used by Recipe text layout.
 * @name Line
 * @class
 * @memberof Recipe#
 * @param {number} width - The line width.
 * @param {number} height - The line height.
 * @param {number} size - The font size.
 * @param {Object} pathOptions - The resolved text options.
 */
// The width of a line without a text box. No text reaches it, so such a line
// accepts every word without measuring.
const UNBOUNDED_LINE_WIDTH = 999999999;

exports.Line = class Line {
  /**
   * @param {number} [width] - The available width; unlimited when omitted.
   * @param {number} [height] - A fixed line height.
   * @param {number} [size] - The font size; defaults to the text options size.
   * @param {Object} pathOptions - The resolved text options.
   */
  constructor(width, height, size, pathOptions) {
    this._width = width || UNBOUNDED_LINE_WIDTH;
    this._height = height;
    this._pathOptions = pathOptions;
    this.size = size || pathOptions.size;
    this._lineID = Date.now() * Math.random();
    this.wordObjects = [];
  }

  /**
   * Replace the line ID; falsy values are ignored.
   * @param {number} id - The new ID.
   */
  set lineID(id) {
    if (id) {
      this._lineID = id;
    }
  }

  /**
   * @returns {number} The line ID, grouping objects laid out on one line.
   */
  get lineID() {
    return this._lineID;
  }

  /**
   * @param {Word} wordObject - The word to append.
   * @returns {void}
   */
  addWord(wordObject) {
    this.wordObjects.push(wordObject);
  }

  /**
   * Append leading spaces.
   * @param {number} amount - The number of spaces.
   * @returns {void}
   */
  indent(amount) {
    for (let i = 0; i < amount; i++) {
      this.addWord(new Word(" ", this._pathOptions));
    }
  }

  /**
   * Mark the final word as the last of the line.
   * @returns {void}
   */
  markLastWord() {
    if (this.wordObjects.length > 0) {
      this.wordObjects[this.wordObjects.length - 1].lastWord();
    }
  }

  /**
   * @returns {Word|undefined} The final word, or undefined for an empty line.
   */
  get lastWord() {
    return this.wordObjects[this.wordObjects.length - 1];
  }

  /**
   * @param {string} text - The text.
   * @returns {number} The width character spacing adds to the text.
   */
  charSpacing(text) {
    return charSpacing(
      text,
      this._pathOptions.charSpace,
      this._pathOptions.direction,
    );
  }

  /**
   * The characters of a text that are drawn, without the formatting
   * characters that reordering drops, so measuring matches drawing.
   * @param {string} text - The text in logical order.
   * @returns {string} The text to measure.
   */
  measured(text) {
    return drawnText(text, this._pathOptions.direction);
  }

  /**
   * @param {Word} wordObject - The word to test.
   * @returns {boolean} Whether the line still fits its width with the word appended.
   */
  canFit(wordObject) {
    // Measuring the whole line for every word is quadratic in its length, and
    // a line without a text box never wraps.
    if (this._width >= UNBOUNDED_LINE_WIDTH) return true;
    // Spacing is counted on the text as typed: drawn, its points come
    // before their letters.
    const value = this.value + wordObject.value;
    const toWidth =
      this._pathOptions.font.calculateTextDimensions(
        this.measured(value),
        this.size,
      ).xMax + this.charSpacing(value);
    return toWidth <= this.width;
  }

  /**
   * Replace the final word and mark the new one as last.
   * @param {Word|string} wordObject - The replacement word.
   * @returns {void}
   */
  replaceLastWord(wordObject) {
    if (typeof wordObject === "string") {
      wordObject = new Word(wordObject, this._pathOptions);
    }
    this.wordObjects.pop();
    this.addWord(wordObject);
    wordObject.lastWord();
  }

  /**
   * @returns {Word[]} The words of the line.
   */
  get words() {
    return this.wordObjects;
  }

  /**
   * @returns {number} The room a space ending a line is given, measured as
   *   "o", as Wasm measures it. The advance a drawn space takes is
   *   `spaceAdvance()` of `text-direction`.
   */
  get spaceWidth() {
    return this._pathOptions.font.calculateTextDimensions("o", this.size).width;
  }

  /**
   * @returns {string} The text of the line.
   */
  get value() {
    const value = this.wordObjects.reduce((string, word) => {
      string += word.value;
      return string;
    }, "");
    return value;
  }

  /**
   * @returns {number} The measured width of the line text.
   */
  get currentWidth() {
    return (
      this._pathOptions.font.calculateTextDimensions(
        this.measured(this.value),
        this.size,
      ).xMax + this.charSpacing(this.value)
    );
  }

  /**
   * @returns {number} The sum of the measured word widths.
   */
  get textWidth() {
    return this.wordObjects.reduce((width, word) => {
      width += word.dimensions.xMax;
      return width;
    }, 0);
  }

  /**
   * @returns {number} The available width.
   */
  get width() {
    return this._width;
  }

  // dynamic adjust height based on word height?
  /**
   * @returns {number} The fixed height, or the measured text height plus 20.
   */
  get height() {
    if (this._height) {
      return this._height;
    }
    const toHeight = this._pathOptions.font.calculateTextDimensions(
      this.value,
      this.size,
    ).height; // ymax
    return toHeight + 20;
  }
};

/**
 * Get the offset for a text box.
 * @private
 * @todo handle page margin and padding
 * @param {Object} textBox - The laid-out text box: width, height, textHeight,
 *   firstLineHeight and isSimpleText.
 * @param {Object} [options] - The text options.
 * @param {string} [options.align] - A `Recipe.HorizontalAlign` value,
 *   optionally followed by a space and a `Recipe.VerticalAlign` value.
 * @returns {{offsetX: number, offsetY: number}} The offset from the placement point.
 */
exports._getTextBoxOffset = function _getTextBoxOffset(textBox, options = {}) {
  let offsetX = 0;
  let offsetY = -textBox.firstLineHeight;
  let { width, height, textHeight } = textBox;
  if (options.align) {
    const alignments = options.align.split(" ");
    if (alignments[0]) {
      switch (alignments[0]) {
        case HorizontalAlign.CENTER:
          offsetX = (-1 * width) / 2;
          break;
        case HorizontalAlign.RIGHT:
          offsetX = -width;
          break;
        default:
      }
    }
    if (alignments[1]) {
      height = height || textHeight;
      switch (alignments[1]) {
        case VerticalAlign.CENTER:
          offsetY = textBox.isSimpleText
            ? -textBox.firstLineHeight / 2
            : height / 2 + offsetY;
          break;
        case VerticalAlign.BOTTOM:
          offsetY = height + offsetY;
          break;
        default:
      }
    }
  }

  return {
    offsetX,
    offsetY,
  };
};

/**
 * Get text dimensions
 * @name textDimensions
 * @function
 * @memberof Recipe#
 * @param {string} text - text to be measured
 * @param {Object} [options] - The options
 * @param {string} [options.font='helvetica'] - name of font from which measurements are to be taken
 * @param {number} [options.size=14] - size of font to be used in taking measurements
 * @param {number} [options.charSpace=0] - character spacing being applied to the given text.
 * @param {boolean} [options.bold] - Measure with the bold style of the font.
 * @param {boolean} [options.italic] - Measure with the italic style of the font.
 * @param {Recipe.TextDirection} [options.direction='none'] - The direction text() would draw the text with;
 * other than 'none', the formatting characters that reordering drops are not measured.
 * @returns {Object} measurement components of given text: width, height, xMin, xMax, yMin, yMax
 * @throws {Error} If the font file cannot be loaded.
 * @throws {TypeError} If `options.direction` is not a `Recipe.TextDirection` value.
 */
exports.textDimensions = function textDimensions(text, options = {}) {
  // null options act like omitted options.
  if (options === null) options = {};
  const drawn = drawnText(text, options.direction);
  const font = this._getFont(options);
  let dimensions = {};
  let charSpaces = 0;

  if (font) {
    // Spacing is counted in the order the text is typed.
    if (options.charSpace) {
      charSpaces = charSpacing(text, options.charSpace, options.direction);
    }
    const fontSize = resolveFontSize(options, this.current.defaultFontSize);
    dimensions = font.calculateTextDimensions(drawn, fontSize);
    dimensions.xMax += charSpaces;
  }

  return dimensions;
};

/**
 * A column used by Recipe text layouts.
 * @name Column
 * @class
 * @memberof Recipe#
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} width - The column width.
 * @param {number} height - The column height.
 * @param {string} [text=''] - The column heading.
 * @param {string} [field=''] - The associated data field.
 * @param {Object} [options] - The column options.
 */
exports.Column = class Column {
  /**
   * @param {number} x - The x coordinate.
   * @param {number} y - The y coordinate.
   * @param {number} width - The column width.
   * @param {number} [height] - The column height; unlimited when omitted.
   * @param {string} [text=''] - The column heading; defaults to the field.
   * @param {string} [field=''] - The associated data field.
   * @param {Object} [options] - The column options; `cell` becomes the text box.
   */
  constructor(x, y, width, height, text = "", field = "", options = {}) {
    this._x = x;
    this._y = y;
    this._width = width;
    this._height = height || 99999;
    this._field = field; // associated data field
    this._text = text || field; // for column title
    this._gap = 0;
    this._options = cloneOptions(options);

    this._options.textBox = this._options.cell;

    if (this._options.cell) {
      delete this._options["cell"];
    }

    if (!this._options.textBox || this._options.textBox.padding === undefined) {
      this._options.textBox = this._options.textBox || {};
      this._options.textBox.padding = 2;
    }

    if (!this._options.header || typeof this._options.header === "boolean") {
      this._options.header = {
        bold: true,
        textBox: {
          padding: 2,
          textAlign: `${HorizontalAlign.CENTER} ${VerticalAlign.CENTER}`,
        },
      };
    }

    if (options.renderer) {
      this._options.renderer = options.renderer;
    }
  }

  /**
   * @returns {number} The column width.
   */
  get width() {
    return this._width;
  }
  /**
   * @returns {number} The column height.
   */
  get height() {
    return this._height;
  }
  /**
   * @returns {number} The column x coordinate.
   */
  get x() {
    return this._x;
  }
  /**
   * @param {number} x - The new x coordinate.
   */
  set x(x) {
    this._x = x;
  }
  /**
   * @returns {number} The column y coordinate.
   */
  get y() {
    return this._y;
  }
  /**
   * @returns {number[]} The column [x, y] position.
   */
  get position() {
    return [this._x, this._y];
  }
  /**
   * @param {number[]} pos - The new [x, y] position.
   */
  set position(pos) {
    [this._x, this._y] = pos;
  }
  /**
   * @returns {number} The gap after the column.
   */
  get gap() {
    return this._gap;
  }
  /**
   * @param {number} gap - The new gap after the column.
   */
  set gap(gap) {
    this._gap = gap;
  }
  /**
   * @returns {string} The associated data field.
   */
  get field() {
    return this._field;
  }
  /**
   * @returns {string} The column heading.
   */
  get text() {
    return this._text;
  }
  /**
   * @returns {Object} The column text options.
   */
  get options() {
    return this._options;
  }
};
