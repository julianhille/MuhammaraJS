var { cloneOptions, resolveFontSize } = require("./utils");
var { HorizontalAlign, VerticalAlign } = require("../recipe-constants");

/**
 * The width character spacing adds between the characters of a text.
 * @private
 * @param {string} text - The text.
 * @param {number} charSpace - The spacing added after each character but the last.
 * @returns {number} The added width.
 */
const charSpacing = function charSpacing(text, charSpace) {
  var characterCount = Array.from(String(text)).length;
  return characterCount ? (characterCount - 1) * charSpace : 0;
};

// Have to set up word as a constant, then export it below
// so that Line can see it. Otherwise, an error is thrown.

const Word = class Word {
  /**
   * @param {string} word - The word, a single space measured as "o".
   * @param {Object} pathOptions - The resolved text options: font, size and charSpace.
   */
  constructor(word, pathOptions) {
    this._value = word;
    this._pathOptions = pathOptions;
    this._last = false;
    this._text = word === " " ? "o" : word; // allows space to get an actual dimension
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
    return charSpacing(this._text, this._pathOptions.charSpace);
  }

  /**
   * Mark the word as the last of its line, trimming trailing space and
   * measuring it again.
   * @param {boolean} [value=true] - Whether the word is last.
   * @returns {void}
   */
  lastWord(value = true) {
    // indicate last word in line (for justification)
    this._last = value;
    if (this._last) {
      this._value = this._value.trim(); // wack any trailing space
      this._text = this._value;
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
exports.Line = class Line {
  /**
   * @param {number} [width] - The available width; unlimited when omitted.
   * @param {number} [height] - A fixed line height.
   * @param {number} [size] - The font size; defaults to the text options size.
   * @param {Object} pathOptions - The resolved text options.
   */
  constructor(width, height, size, pathOptions) {
    this._width = width || 999999999;
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
    return charSpacing(text, this._pathOptions.charSpace);
  }

  /**
   * @param {Word} wordObject - The word to test.
   * @returns {boolean} Whether the line still fits its width with the word appended.
   */
  canFit(wordObject) {
    const tempValue = this.value + wordObject.value;
    const toWidth =
      this._pathOptions.font.calculateTextDimensions(tempValue, this.size)
        .xMax + this.charSpacing(tempValue);
    return toWidth <= this.width;
  }

  replaceLastWord(wordObject) {
    if (typeof wordObject === "string") {
      wordObject = new Word(wordObject, this._pathOptions);
    }
    this.wordObjects.pop();
    this.addWord(wordObject);
    wordObject.lastWord();
  }

  get words() {
    return this.wordObjects;
  }

  get spaceWidth() {
    return this._pathOptions.font.calculateTextDimensions("o", this.size).width;
  }

  get value() {
    const value = this.wordObjects.reduce((string, word) => {
      string += word.value;
      return string;
    }, "");
    return value;
  }

  get currentWidth() {
    return (
      this._pathOptions.font.calculateTextDimensions(this.value, this.size)
        .xMax + this.charSpacing(this.value)
    );
  }

  get textWidth() {
    return this.wordObjects.reduce((width, word) => {
      width += word.dimensions.xMax;
      return width;
    }, 0);
  }

  get width() {
    return this._width;
  }

  // dynamic adjust height based on word height?
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
 * @returns {Object} measurement components of given text: width, height, xMin, xMax, yMin, yMax
 */
exports.textDimensions = function textDimensions(text, options = {}) {
  const font = this._getFont(options);
  let dimensions = {};
  let charSpaces = 0;

  if (font) {
    if (options.charSpace) {
      charSpaces = charSpacing(text, options.charSpace);
    }
    const fontSize = resolveFontSize(options, this.current.defaultFontSize);
    dimensions = font.calculateTextDimensions(text, fontSize);
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

  get width() {
    return this._width;
  }
  get height() {
    return this._height;
  }
  get x() {
    return this._x;
  }
  set x(x) {
    this._x = x;
  }
  get y() {
    return this._y;
  }
  get position() {
    return [this._x, this._y];
  }
  set position(pos) {
    [this._x, this._y] = pos;
  }
  get gap() {
    return this._gap;
  }
  set gap(gap) {
    this._gap = gap;
  }
  get field() {
    return this._field;
  }
  get text() {
    return this._text;
  }
  get options() {
    return this._options;
  }
};
