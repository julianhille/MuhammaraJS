const LineBreaker = require("linebreak");
const { Word, Line, Column } = require("./text.helper");
const { htmlToTextObjects, HtmlTag } = require("./htmlToTextObjects");
const { Color, xObjectForm } = require("./xObjectForm");
const { linkPdf } = require("./annotation");
const { resolveFontSize, trimBreakableEnd } = require("./utils");
const { miterLimitOption, rotationOption } = require("../recipe-options");
const {
  TextWrap,
  TextAlign,
  VerticalAlign,
  HorizontalAlign,
  Colorspace,
} = require("../recipe-constants");

/**
 * Matches HTML that ends with a closed block element, which ends its line.
 */
const BLOCK_END = /<\/(?:p|div|ul|ol|li|h[1-6]|blockquote|pre)\s*>\s*$/i;

/**
 * Matches HTML that opens with a block element, which starts a new line.
 */
const BLOCK_START = /^\s*<(?:p|div|ul|ol|li|h[1-6]|blockquote|pre)\b/i;

/**
 * Matches the line break that ends a word at a required break.
 */
const LINE_BREAK_END = /(?:\r\n|[\n\r\v\f\u0085\u2028\u2029])$/;

/**
 * Find the first node with text, unless a line break or block element comes
 * before it.
 * @private
 * @param {Object[]} nodes - HTML layout nodes in drawing order.
 * @returns {Object|undefined} The node, or undefined.
 */
function firstInlineText(nodes) {
  for (const node of nodes) {
    if (node.lineBreak || node.needsLineBreaker) return undefined;
    if (node.value) return node;
    if (node.childs?.some(hasLayout)) return firstInlineText(node.childs);
  }
  return undefined;
}

/**
 * Report whether an HTML layout node has text or a line break to lay out.
 * @private
 * @param {Object} textObject - The layout node.
 * @returns {boolean} Whether laying the node out adds a run.
 */
function hasLayout(textObject) {
  return Boolean(
    textObject.lineBreak ||
    textObject.value ||
    textObject.childs?.some(hasLayout),
  );
}

//  Table indicating how to specify coloration of elements
//  -------------------------------------------------------------------
// |Color | HexColor   | DecimalColor                   | PercentColor |
// |Space | (string)   | (array)                        | (string)     |
// |------+------------+--------------------------------+--------------|
// | Gray | #GG        | [gray]                         | %G           |
// |  RGB | #rrggbb    | [red, green, blue]             | %G           |
// | CMYK | #ccmmyykk  | [cyan, magenta, yellow, black] | %c,m,y,k     |
//  -------------------------------------------------------------------
//
//   HexColor component values (two hex digits) range from 00 to FF.
//   DecimalColor component values range from 0 to 255.
//   PercentColor component values range from 1 to 100.

// function merge (target, source) {
//     // Iterate through `source` properties and if an `Object` set property to merge of `target` and `source` properties
//     for (const key of Object.keys(source)) {
//         if (Array.isArray(source[key])) {
//             target[key] = source[key];  // don't want to merge elements, just accept new values.
//         } else if (source[key] instanceof Object && key in target) {
//             Object.assign(source[key], merge(target[key], source[key]));
//         }
//     }

//     // Join `target` and modified `source`
//     // Forcing non-object to become one. This allows
//     // things like hilite:true become hilite:{color:'red'}
//     if (! (target instanceof Object)) {
//         target = {};
//     }
//     Object.assign(target, source)
//     return target
// }

/**
 * Merge text options: arrays and non-object values from `source` replace those
 * in `target`, and nested objects are merged. `source` objects are updated in
 * place; the result is a new object.
 * @private
 * @param {Object} target - The base options.
 * @param {Object} source - The overriding options.
 * @returns {Object} The merged options.
 */
exports._merge = function merge(target, source) {
  // Iterate through `source` properties and if an `Object` set property to merge of `target` and `source` properties
  for (const key of Object.keys(source)) {
    if (Array.isArray(source[key])) {
      target[key] = source[key]; // don't want to merge elements, just accept new values.
    } else if (
      source[key] instanceof Object &&
      target instanceof Object &&
      key in target
    ) {
      Object.assign(source[key], merge(target[key], source[key]));
    }
  }

  // Join `target` and modified `source`
  // Forcing non-object to become one. This allows
  // things like hilite:true become hilite:{color:'red'}
  if (!(target instanceof Object)) {
    target = {};
  }
  return Object.assign({}, target, source);
};

/**
 * Reject a character spacing that cannot become a `Tc` operand.
 * @private
 * @param {Object} [options] - The text options of one text() call.
 * @returns {void}
 * @throws {TypeError} If `options.charSpace` is given and is not a finite number.
 */
function _validateCharSpace(options) {
  const charSpace = options?.charSpace ?? 0;
  if (!Number.isFinite(charSpace)) {
    throw new TypeError("charSpace must be a finite number");
  }
}

/**
 * Resolve the text position and options for text(): a call without
 * coordinates continues the flow or starts at the margins, a call with them
 * starts a new text box; previous options are merged in.
 * @private
 * @param {Recipe} self - The recipe instance.
 * @param {number|"center"|Object} [x] - The x coordinate, or the options.
 * @param {number|"center"} [y] - The y coordinate.
 * @param {Object} [options] - The text options.
 * @returns {Object} The merged text options.
 * @throws {TypeError} If no page is active.
 */
function _initOptions(self, x = {}, y, options = {}) {
  // This allows user to skip providing x/y coordinates
  if (typeof x === "object") {
    options = x;
    self._textOptions = self._textOptions || { textBox: {} };
    self._flow = options.flow === undefined ? true : options.flow;

    if (options.layout) {
      self._columns = self._layouts[options.layout];
      self.x = self._columns[0].x;
      self.y = self._columns[0].y;
      self.box = { x: self.x, y: self.y };
      self._firstLineHeight = 0;
    }

    // The following only happens when 'text' is called
    // for the first time without any position coordinates.
    if (self.box === undefined) {
      if (!options.layout) {
        self.x = self._margin.left;
        self.y = self._margin.top;
      }

      self.box = { x: self.x, y: self.y };
      self._firstLineHeight = 0;
    }
  } else {
    // Update the current position, when provided.
    [x, y] = self._centrify(x, y);
    self.x = x;
    self.y = y;
    self.box = { x, y };
    self._firstLineHeight = 0; // indicates not set yet, determined later.
    self._textOptions = { textBox: {} };
    self._previousTextObjects = [];
    self._flow = options.flow || false;

    if (options.layout) {
      self._columns = self._layouts[options.layout];

      // Only tinker with the column coordinates when the incoming
      // [x,y] coordinates differ from the first layout element.

      if (x !== self._columns[0].x || y !== self._columns[0].y) {
        // Override layout values.
        adjustcolumnPosition(self._columns, x, y);
      }
    }
  }

  self._previousTextObjects = self._previousTextObjects || [];

  // Merge any previous options with new options
  const mergedOpts = self._merge(self._textOptions, options);

  if (self._flow && mergedOpts.textBox.width === undefined) {
    mergedOpts.textBox.width = Math.max(
      0,
      self.metadata[self.pageNumber].width - self.x - self._margin.right,
    );
  }

  if (options.layout) {
    self._columns = self._layouts[options.layout];
    mergedOpts.textBox.width = self._columns[0].width;
    mergedOpts.textBox.height = self._columns[0].height;
  }

  if (options.overflow) {
    self._overflowNotifier = options.overflow;
  }

  return mergedOpts;
}

/**
 * Whether a value is missing or an empty plain object.
 * @private
 * @param {*} obj - The value.
 * @returns {boolean} True for a falsy value or an empty plain object.
 */
function isEmpty(obj) {
  return !obj || (Object.keys(obj).length === 0 && obj.constructor === Object);
}

/**
 * Wrap plain text as a one-element list of text layout objects, the same
 * shape htmlToTextObjects() returns.
 * @private
 * @param {string} text - The text.
 * @param {number} size - The font size.
 * @param {Object} options - The text options: font, bold and italic.
 * @returns {Object[]} The text layout objects.
 */
exports._makeTextObject = function _makeTextObject(text, size, options) {
  return [
    {
      value: text,
      tag: null,
      font: options.font,
      isBold: options.bold,
      isItalic: options.italic,
      attributes: [],
      styles: {},
      needsLineBreaker: false,
      size: size,
      sizeRatio: 1,
      sizeRatios: [1],
      link: null,
      childs: [],
    },
  ];
};

/**
 * Build the text box from the textBox options; without them the text is
 * simple, page-wide text.
 * @private
 * @param {Object} options - The text options.
 * @returns {Object} The text box: width, height, lineHeight, padding,
 *   minHeight, style, textAlign, clipping and wrap settings.
 */
exports._makeTextBox = function _makeTextBox(options) {
  return isEmpty(options.textBox)
    ? {
        // use page width with padding and margin
        isSimpleText: true,
        width: null,
        lineHeight: 0,
        padding: 0,
        minHeight: 0,
        wrap: TextWrap.AUTO,
      }
    : {
        width: options.textBox.width || 100,
        lineHeight: options.textBox.lineHeight,
        height: options.textBox.height,
        padding: options.textBox.padding || 0,
        minHeight: options.textBox.minHeight || 0,
        style: options.textBox.style,
        textAlign: options.textBox.textAlign,
        clipIfExceedsBox: options.textBox.clipIfExceedsBox,
        onClip: options.textBox.onClip,
        wrap:
          options.textBox.wrap !== undefined
            ? options.textBox.wrap
            : TextWrap.AUTO,
      };
};

/**
 * Write text elements
 * @name text
 * @function
 * @todo support break words
 * @memberof Recipe#
 * @param {string} [text=''] - The text content
 * @param {number|"center"|Object} [x] - The coordinate x, or the options to continue at the current position
 * @param {number|"center"} [y] - The coordinate y
 * @param {Object} [options] - The options
 * @param {string|number[]} [options.color] - Text color (HexColor, PercentColor or DecimalColor)
 * @param {number} [options.opacity=1] - opacity
 * @param {number} [options.rotation=0] - Clockwise rotation in degrees, +/- 0 through 360.
 * @param {number[]} [options.rotationOrigin=[x,y]] - [originX, originY]
 * @param {string} [options.font] - The font. 'Arial', 'Helvetica'...; defaults to the Recipe's `defaultFontFamily`
 * @param {number} [options.size=14] - The font size
 * @param {number} [options.charSpace=0] - space to be added between characters, units in points.
 * @param {string} [options.align='left top'] - This is the alignment of the text in relationship to its position
 * coordinates, specified as 'horizontal vertical': a `Recipe.HorizontalAlign` value, optionally followed by a
 * space and a `Recipe.VerticalAlign` value.
 * @param {Object|Boolean} [options.highlight] - Text markup annotation.
 * @param {Object|Boolean} [options.underline] - Text markup annotation.
 * @param {Object|Boolean} [options.strikeOut] - Text markup annotation.
 * @param {Boolean} [options.html] - Interpret text as html
 * @param {Boolean} [options.flow] - Used to activate/deactivate text flow which is the
 * ability to use multiple calls to 'text' to create an overall text box. Defaults to
 * `true` for a call without coordinates and `false` for a call with them.
 * @param {number|string} [options.layout] - An identifier of the layout to be associated with given text.
 * @param {function} [options.overflow] - Called when the text is going to exceed the area
 * of the given text object. Intended for column layouts. Its parameter is (self) where 'self' is the recipe handle so
 * that other recipe interfaces can be called. The return value can be 'true' which indicates that text processing
 * should stop, or 'false' which indicates that the text should continue being processed with the original [x,y]
 * coordinates, or it can be an object containing a 'column' property indicating either a layout column index
 * or a set of [x,y] coordinates where the next set of layout columns should be positioned for the remaining text.
 * @param {Boolean|Object} [options.hilite=false] - Used to hilite given text.
 * @param {string|number[]} [options.hilite.color=yellow] - text hilite color (HexColor, PercentColor or DecimalColor)
 * @param {number} [options.hilite.opacity=.5] - text hilite color opacity
 * @param {Object} [options.textBox] - Text Box to fit in.
 * @param {number} [options.textBox.width=100] - Text Box width
 * @param {number} [options.textBox.height] - Text Box fixed height
 * @param {number} [options.textBox.minHeight=0] - Text Box minimum height
 * @param {number|number[]} [options.textBox.padding=0] - Text Box padding, [top, right, bottom, left]
 * @param {number} [options.textBox.lineHeight=0] - Text Box line height
 * @param {Recipe.TextWrap|Boolean} [options.textBox.wrap='auto'] - Text wrapping mechanism, may be true, false,
 * or a `Recipe.TextWrap` value: 'auto', 'clip', 'trim', 'ellipsis'. All the option values that are not equivalent to 'auto' dictate
 *  how the text which does not fit on a line is to be truncated. True is equivalent to 'auto'. False is equivalent to 'ellipsis'.
 * @param {string} [options.textBox.textAlign='left top'] - Alignment inside text box, specified as 'horizontal vertical',
 * where horizontal is a `Recipe.TextAlign` value and vertical a `Recipe.VerticalAlign` value.
 * @param {boolean} [options.textBox.clipIfExceedsBox=false] - Render only complete lines that fit within the text box height.
 * @param {function} [options.textBox.onClip] - Called as onClip(recipe, result) when clipping leaves text unrendered.
 * Do not call endPage() or endPDF() in this callback because the text operation is still active.
 * @param {Object} [options.textBox.style] - Text Box styles
 * @param {number} [options.textBox.style.lineWidth=2] - Text Box border width
 * @param {string|number[]} [options.textBox.style.stroke] - Text Box border color  (HexColor, PercentColor or DecimalColor)
 * @param {number[]} [options.textBox.style.dash=[]] - Text Box border border dash style [number, number]
 * @param {string|number[]} [options.textBox.style.fill] - Text Box border background color (HexColor, PercentColor or DecimalColor)
 * @param {number} [options.textBox.style.opacity=1] - Text Box border background opacity
 * @param {boolean|number|number[]} [options.textBox.style.borderRadius=0] - Border radius to apply to get rounded corners.
 * @param {string} [options.title] - Title of annotation
 * @param {boolean} [options.open=false] - Open the annotation. Annotation will be closed by default. Specific to text annotations; subtype='Text'
 * @param {boolean} [options.richText] - Rich text in annotation
 * @param {Recipe.AnnotFlag} [options.flag] - The annotation flag, a `Recipe.AnnotFlag` value.
 * @param {Recipe.AnnotIcon} [options.icon='Note'] - The icon of annotation, a `Recipe.AnnotIcon` value. Specific to text annotations.
 * @param {string} [options.date] - Date of text to show up on annotation
 * @param {string} [options.subject] - Subject of annotation.
 * @param {string} [options.link] - Make the text open this URL.
 * @returns {Recipe} The recipe instance. Without an active page nothing is drawn.
 * @throws {TypeError} If `options.charSpace` or `options.rotation` is not a finite number; nothing is drawn.
 * @throws {RangeError} If `options.size` is not greater than zero or
 *   `options.miterLimit` is below 1; nothing is drawn.
 * @throws {Error} If an overflow callback names an undefined layout, or a font cannot be loaded.
 */
exports.text = function text(text = "", x, y, options = {}) {
  // null options act like omitted options.
  if (options === null) options = {};
  if (!this.pageContext) {
    return this;
  }
  // A call with coordinates starts a new text box, so an open flow is drawn
  // first instead of being discarded.
  // Validate before _initOptions moves the text position or resets the flow,
  // and before an open flow is drawn.
  const rawOptions = (typeof x === "object" ? x : options) || {};
  _validateCharSpace(rawOptions);
  rotationOption(rawOptions.rotation);
  miterLimitOption(rawOptions.miterLimit);
  resolveFontSize(rawOptions);
  // Reject invalid markup annotations before any text is drawn.
  for (let key in rawOptions) {
    if (this._getTextMarkupAnnotationSubtype(key) && rawOptions[key]) {
      const markup = typeof rawOptions[key] === "object" ? rawOptions[key] : {};
      this._validateAnnot({ ...markup, flag: rawOptions.flag });
    }
  }
  if (typeof x !== "object" && x !== undefined) {
    this._flushTextFlow();
  }
  options = _initOptions(this, x, y, options);
  const linkX = this.x;
  const linkY = this.y;

  const targetAnnotations = options;
  const originCoord = this._calibrateCoordinate(
    this.x,
    this.y,
    0,
    0,
    this.pageNumber,
  );
  const pathOptions = this._getPathOptions(
    options,
    originCoord.nx,
    originCoord.ny,
  );
  pathOptions.html = options.html;
  pathOptions.link = options.link;
  pathOptions.hilite = options.hilite;

  // save text state for continued text?
  this._textOptions = this._flow ? options : { textBox: {} };

  // Line breaks that end a flowed run end its line, as movedown() does,
  // instead of being drawn.
  let trailingBreaks = 0;
  if (this._flow) {
    const breaks = /\n+$/.exec(text);
    if (breaks) {
      trailingBreaks = breaks[0].length;
      text = text.slice(0, breaks.index);
      if (text === "" && this._previousTextObjects.length) {
        return this.movedown(trailingBreaks);
      }
    }
  }

  // HTML without text or line breaks has nothing to lay out, which would
  // discard the runs of an open flow, so it is laid out as empty plain text.
  let textObjects =
    options.html && text !== "" ? htmlToTextObjects(text, options) : null;
  if (
    textObjects &&
    this._previousTextObjects.length &&
    !textObjects.some(hasLayout)
  ) {
    textObjects = this._makeTextObject("", pathOptions.size, options);
  }
  textObjects =
    textObjects || this._makeTextObject(text, pathOptions.size, options);

  // HTML continues the open line of a flow unless it opens with a block
  // element or the run before closed one. It then keeps one space that
  // starts it, as HTML text after inline content does, unless the run
  // before ends with a space.
  pathOptions.startsBlock = Boolean(options.html) && BLOCK_START.test(text);
  const openRun =
    this._previousTextObjects[this._previousTextObjects.length - 1];
  if (
    options.html &&
    /^\s/.test(text) &&
    openRun &&
    !openRun.lineComplete &&
    /\S$/.test(openRun.text) &&
    !this._flowEndsBlock &&
    !pathOptions.startsBlock
  ) {
    const first = firstInlineText(textObjects);
    if (first && !/^\s/.test(first.value)) {
      // A space before an element is a run of its own, as in one call.
      if (textObjects.includes(first)) first.value = " " + first.value;
      else {
        textObjects.unshift(
          ...this._makeTextObject(" ", pathOptions.size, options),
        );
      }
    }
  }
  const textBox = this._makeTextBox(options);

  if (textBox.onClip && !textBox.clipIfExceedsBox) {
    console.warn(
      "textBox.onClip will not be called unless textBox.clipIfExceedsBox is true.",
    );
  }

  let { toWriteTextObjects } = this._layoutText(
    textObjects,
    textBox,
    pathOptions,
  );
  const linkAnnotations = [];

  if (!textBox.width) {
    textBox.width = toWriteTextObjects[0].lineWidth;
  }

  textBox.firstLineHeight = this._firstLineHeight;

  // need to collect all the text that is 'flowing' before processing.
  if (this._flow) {
    this._previousTextObjects = [...toWriteTextObjects];
    // A later HTML run starts a new line after a closed block element.
    this._flowEndsBlock = Boolean(options.html) && BLOCK_END.test(text);
    if (trailingBreaks) this.movedown(trailingBreaks);
  } else {
    this._flowEndsBlock = false;
    // Runs of different sizes on one line share its baseline and height; the
    // first line moves down by what it grew so its tallest run fits the box,
    // and movedown() moves by its full height.
    // An empty first run that a later run replaced does not size it either.
    const firstLineHeight = toWriteTextObjects[0]?.lineHeight;
    alignLineBaselines(toWriteTextObjects);
    if (firstLineHeight !== undefined) {
      this._lineHeight += toWriteTextObjects[0].lineHeight - firstLineHeight;
      this._firstLineHeight = toWriteTextObjects[0].lineHeight;
      textBox.firstLineHeight = this._firstLineHeight;
    }
    textBox.textHeight = getTextBoxHeight(toWriteTextObjects);

    let clipResult;
    if (textBox.clipIfExceedsBox && textBox.height !== undefined) {
      const clippedText = clipTextToBox(
        toWriteTextObjects,
        textBox.height - textBox.paddingTop - textBox.paddingBottom,
      );
      toWriteTextObjects = clippedText.textObjects;
      textBox.textHeight = getTextBoxHeight(toWriteTextObjects);

      if (clippedText.clipped) {
        clipResult = {
          remainder: clippedText.remainder,
          linesWritten: clippedText.linesWritten,
          clipped: true,
          bounds: {
            x: this.x,
            y: this.y,
            width: textBox.width,
            height: textBox.height,
          },
        };
      }
    }

    let [nx, ny] = getTextBoxPosition(this, textBox, pathOptions);
    let textYpos = ny;

    // Need to determine textBox.height option before
    // actually drawing any text box, or determining
    // vertical positioning of text.
    if (!textBox.height) {
      textBox.height =
        textBox.textHeight + textBox.paddingTop + textBox.paddingBottom;

      if (textBox.minHeight && textBox.minHeight > textBox.height) {
        textBox.height = textBox.minHeight;
      }
    }

    if (textBox.style) {
      drawTextBox(this, nx, ny, textBox, pathOptions);
    }

    // Determine vertical starting position of text within textBox
    switch (
      toWriteTextObjects.length
        ? toWriteTextObjects[0].writeOptions.alignVertical
        : undefined
    ) {
      case VerticalAlign.CENTER:
        textYpos -=
          (textBox.height - textBox.textHeight) / 2 - textBox.paddingTop;
        break;
      case VerticalAlign.BOTTOM:
        textYpos -= textBox.height - textBox.textHeight - textBox.paddingBottom;
        break;
    }

    let currentY = textYpos - textBox.paddingTop;
    let boxTop = currentY;
    let currentLineID;
    let currentLineWidth = 0;
    let toWriteContents = [];
    let columnIndex = 1;

    toWriteTextObjects.some((toWriteTextObject, index) => {
      const { text, lineHeight, lineWidth, lineID, spaceWidth } =
        toWriteTextObject;

      currentLineID = currentLineID || lineID;
      const isContinued = currentLineID == lineID ? true : false;

      /**
       * Where a line's first run starts, from the box edge and the line's
       * alignment.
       * @param {number} startX - The x of the box edge plus the width of the
       *   line's runs before the run.
       * @param {Object} content - The run, whose alignment places the line.
       * @returns {number} The x of the run.
       */
      const getStartX = (startX, content) => {
        // Right alignment leaves out the space that ends the line, which
        // belongs to its last run with text; every run of the line shifts
        // alike.
        const lastContent =
          toWriteContents.findLast((run) => run.text !== "") || content;
        let spaceWidth = lastContent.text.endsWith(" ")
          ? lastContent.spaceWidth
          : 0;
        let offsetX;
        switch (content.writeOptions.alignHorizontal) {
          case TextAlign.CENTER:
            offsetX = (textBox.width - currentLineWidth) / 2;
            break;
          case TextAlign.RIGHT:
            offsetX =
              textBox.width -
              textBox.paddingRight -
              currentLineWidth +
              spaceWidth;
            break;
          default:
            offsetX = textBox.paddingLeft;
            break;
        }

        return startX + offsetX;
      };

      const addUnderline = (x, y, ctx, options) => {
        // underline implementation
        if (options.underline) {
          const underlineY = y - options.textHeight * 0.1;
          const width = options.lineWidth;
          ctx.q();
          if (options.colorModel.xObject) {
            this._setSeparationColor(
              options.colorModel.xObject,
              options.colorModel,
              true,
            );
          }
          ctx
            .drawPath(
              x,
              underlineY,
              x + width,
              underlineY,
              this._devicePathOptions(options),
            )
            .Q();
        }
      };

      const addStrikeOut = (x, y, ctx, options) => {
        // strikethrough implementation
        if (options.strikeOut) {
          const strikeOutY = y + options.textHeight * 0.2;
          const width = options.lineWidth;
          ctx.q();
          if (options.colorModel.xObject) {
            this._setSeparationColor(
              options.colorModel.xObject,
              options.colorModel,
              true,
            );
          }
          ctx
            .drawPath(
              x,
              strikeOutY,
              x + width,
              strikeOutY,
              this._devicePathOptions(options),
            )
            .Q();
        }
      };

      const addTextTraits = (ctx, options) => {
        ctx.Tf(options.font, options.size);
        ctx.Tc(options.charSpace);
        if (options.colorModel.xObject) {
          options.colorModel.xObject.fill(options.colorModel);
        } else {
          Color.fill(ctx, options.colorModel);
        }
      };

      const emitText = (word, x, y, ctx) => {
        ctx.Tm(1, 0, 0, 1, x, y);
        ctx.Tj(word);
      };

      const emitTextObject = (text, x, y, ctx, options) => {
        ctx.BT();
        addTextTraits(ctx, options);
        emitText(text, x, y, ctx);
        ctx.ET();

        addUnderline(x, y, ctx, options);
        addStrikeOut(x, y, ctx, options);
      };

      const justifyText = (left, x, wto, textBox, ctx, options, callback) => {
        ctx.BT();
        addTextTraits(ctx, options);
        let next_x = justify(left, x, wto, textBox, callback);
        ctx.ET();
        return next_x;
      };

      const updateTextBox = (columns) => {
        textBox.width = columns.width; // in case user changed column layout
        textBox.height = columns.height;
        [nx, ny] = getTextBoxPosition(this, textBox, pathOptions);
        boxTop = currentY = ny;
        if (textBox.style) {
          drawTextBox(this, nx, currentY, textBox, pathOptions);
        }
      };

      const writeText = (x, y, wto) => {
        const options = wto.writeOptions;
        const { lineWidth, lineHeight, text, baseline } = wto;
        let next_x = 0;

        if (text === "") {
          // nothing to write, so simply escape.
          return next_x;
        }
        // The opacity and rotation path below resets x to the text box edge;
        // text-markup annotations need the line's own start.
        const lineX = x;

        if (options.underline || options.strikeOut) {
          options.lineWidth = lineWidth;
        }

        // Produce a hilite under words?
        if (options.hilite) {
          const bgColor = options.hilite.color || "#ffff00";
          const bgOpacity = options.hilite.opacity || 0.5;
          let bxWidth = wto.lineWidth;

          // The hiliting rectangle cannot use the text box line
          // width when justification is activated because the
          // spaces between words is calculated dynamically.
          if (options.alignHorizontal === TextAlign.JUSTIFY) {
            bxWidth = justify(nx, x, wto, textBox) - x;

            // Except for 'right' alignment cases, have to consider
            // text on line ending with spaces to tweak box width.
          } else if (options.alignHorizontal !== TextAlign.RIGHT) {
            if (text.endsWith(" ")) {
              bxWidth += wto.spaceWidth;
            }
          }

          this.rectangle(x, y, bxWidth, options.textHeight, {
            useGivenCoords: true,
            rotation: pathOptions.rotation,
            rotationOrigin: [pathOptions.originX, pathOptions.originY],
            fill: bgColor,
            opacity: bgOpacity,
          });
        }

        // Note that the last line of a text box ignores justification.
        const _justify =
          options.alignHorizontal === TextAlign.JUSTIFY && !wto.lastLine;

        // write directly to page when not dealing with opacity, rotation and special colorspace.
        if (
          options.opacity === 1 &&
          options.colorspace !== Colorspace.SEPARATION &&
          (options.rotation === 0 || options.rotation === undefined)
        ) {
          // Read the context here: a hilite rectangle or an earlier line may
          // have paused an edited page, which resumes into a new context.
          const context = this.pageContext;
          context.q();

          if (_justify) {
            next_x = justifyText(
              nx,
              x,
              wto,
              textBox,
              context,
              options,
              (word, xx) => {
                emitText(word.value, xx, y + baseline, context);
              },
            );
          } else {
            if (textBox.wrap !== TextWrap.AUTO) {
              // This applies a clipping region around the text
              context
                .m(nx, y + lineHeight)
                .l(nx + textBox.width, y + lineHeight)
                .l(nx + textBox.width, y)
                .l(nx, y)
                .h()
                .W()
                .n();
            }

            emitTextObject(text, x, y + baseline, context, options);
          }

          context.Q();
        } else {
          this.pauseContext();

          // https://github.com/galkahana/HummusJS/wiki/Use-the-pdf-drawing-operators
          const xObject = new xObjectForm(
            this.writer,
            textBox.width,
            lineHeight,
          );
          const xObjectCtx = xObject.getContentContext();
          if (options.colorModel) {
            options.colorModel.xObject = xObject;
          }

          xObjectCtx.q();
          xObjectCtx.gs(xObject.getGsName(options.fillGsId)); // set graphic state (here opacity)

          if (_justify) {
            next_x = justifyText(
              nx,
              x,
              wto,
              textBox,
              xObjectCtx,
              options,
              (word, xx) => {
                emitText(word.value, xx - nx, baseline, xObjectCtx, options);
              },
            );
          } else {
            emitTextObject(text, x - nx, baseline, xObjectCtx, options);
          }

          xObjectCtx.Q();
          xObject.end();

          // To get proper alignment, reset back to textbox
          // coordinate in case text segment encountered.
          x = nx;

          this.resumeContext();

          this.pageContext.q();
          this._setRotationContext(this.pageContext, x, y, options);
          this.pageContext.doXObject(xObject).Q();
        }

        const { textHeight } = options;

        var markupLeft = lineX;
        var markupBottom = y - textHeight * 0.2;
        var markupWidth = _justify ? next_x - lineX : currentLineWidth;
        var markupHeight = textHeight * 1.4;
        if (textBox.wrap === TextWrap.CLIP) {
          // Clipped runs retain the first overflowing word, so measure the
          // drawn text instead of using the preceding fitting line's width.
          var markupRight = Math.min(
            lineX + new Word(text, options).dimensions.xMax,
            nx + textBox.width,
          );
          var markupTop = Math.min(markupBottom + markupHeight, y + lineHeight);
          markupLeft = Math.max(markupLeft, nx);
          markupBottom = Math.max(markupBottom, y);
          markupWidth = markupRight - markupLeft;
          markupHeight = markupTop - markupBottom;
          if (markupWidth <= 0 || markupHeight <= 0) return next_x;
        }

        for (let key in targetAnnotations) {
          const subtype = this._getTextMarkupAnnotationSubtype(key);
          if (subtype && targetAnnotations[key]) {
            // Copy so the caller's markup options are not modified.
            const markupOption =
              typeof targetAnnotations[key] != "object"
                ? {}
                : { ...targetAnnotations[key] };
            const { title, open, richText, flag, icon, date, subject } =
              targetAnnotations;
            Object.assign(markupOption, {
              height: markupHeight,
              width: markupWidth,
              text: markupOption.text || "",
              // add options to annotation
              title: title || "",
              open: Boolean(open),
              richText: Boolean(richText),
              flag: flag || "",
              icon: icon || "",
              date: date || "",
              subject: subject || "",
            });
            // annot() takes the rectangle's top-left corner.
            const { ox, oy } = this._reverseCoordinate(
              markupLeft,
              markupBottom + markupHeight,
            );

            this.annot(ox, oy, subtype, markupOption);
          }
        }

        return next_x;
      };

      /** Queues a text link limited to the run's visible clipping region. */
      var queueTextLink = function (content, x, y, nextX) {
        // The empty run that ends a flow inherits the link but covers nothing.
        if (!content.writeOptions.link || !content.text) return;
        var left = x;
        var width = nextX ? nextX - x : content.lineWidth;
        if (textBox.wrap === TextWrap.CLIP) {
          var right = Math.min(
            x + new Word(content.text, content.writeOptions).dimensions.xMax,
            nx + textBox.width,
          );
          left = Math.max(left, nx);
          width = right - left;
          if (width <= 0) return;
        }
        linkAnnotations.push({
          url: content.writeOptions.link,
          left,
          bottom: y,
          width,
          height: content.lineHeight,
        });
      };

      if (!isContinued) {
        // flush out current line before processing next one
        let next_x = 0;
        toWriteContents.forEach((content) => {
          const x = next_x || getStartX(content.startX, content);
          const y = currentY;
          next_x = writeText(x, y, content);
          queueTextLink(content, x, y, next_x);
        });
        // The line offset from the last line in the
        // group determines Y positioning for next line.
        let lineOffset = toWriteContents.length
          ? toWriteContents[toWriteContents.length - 1].lineOffset
          : 1;
        let yDiff = lineHeight * lineOffset;
        let overflow = false;
        let updateVertical = true;
        toWriteContents = [];
        currentLineID = lineID;
        currentLineWidth = 0;

        if (this._columns) {
          const boxHeight = boxTop - currentY + yDiff;
          if (boxHeight > textBox.height - lineHeight) {
            if (columnIndex >= this._columns.length) {
              overflow = true;
            } else {
              [this.x, this.y] = this._columns[columnIndex].position;
              updateTextBox(this._columns[columnIndex]);
              columnIndex++;
              updateVertical = false;
            }
          }
        }

        if (overflow && this._overflowNotifier) {
          flushTextLinks(this, linkAnnotations);
          let orders = this._overflowNotifier(this);
          if (orders === true) {
            return true; // stop processing remaining text.
          }
          if (orders.layout !== undefined) {
            this._columns = this._layouts[orders.layout];
            if (!this._columns) {
              throw new Error(`Layout '${orders.layout}' is undefined.`);
            }
            if (!orders.column) {
              orders.column = 0;
            }
          }

          if (orders.column !== undefined) {
            if (Array.isArray(orders.column)) {
              let [xx, yy] = orders.column;
              [this.x, this.y] = orders.column;
              adjustcolumnPosition(this._columns, xx, yy);
              columnIndex = 1;
            } else {
              columnIndex = orders.column;
              [this.x, this.y] = this._columns[columnIndex++].position;
            }
            updateTextBox(this._columns[columnIndex - 1]);
            updateVertical = false;
          }
        }

        if (updateVertical) {
          currentY -= yDiff;
          this.y += yDiff;
        }

        this._previousTextObjects.shift();
      }

      const startX = nx + currentLineWidth;

      toWriteTextObject.startX = toWriteTextObject.startX || startX;
      toWriteContents.push(toWriteTextObject);

      // To handle text that has been split in middle of word,
      // need to decide if current text ends with a space. HTML segments carry
      // their own separating space, so adding one unconditionally in HTML mode
      // measured every line a space wider than it is drawn and pushed aligned
      // lines left.
      currentLineWidth +=
        lineWidth + (toWriteTextObject.text.endsWith(" ") ? spaceWidth : 0);

      // Processing last text object?
      if (index === toWriteTextObjects.length - 1) {
        if (this._flow) {
          if (toWriteTextObject.lineComplete) {
            this._previousTextObjects = [];
          } else {
            this._previousTextObjects = [...toWriteContents];
            toWriteContents = [];
          }
        }

        let next_x = 0;
        for (let ii = 0; ii < toWriteContents.length; ii++) {
          const content = toWriteContents[ii];
          const x = next_x || getStartX(content.startX, content);
          const y = currentY;
          next_x = writeText(x, y, content);
          queueTextLink(content, x, y, next_x);
        }

        // Flush any left over text objects.
        if (!this._flow) {
          this._previousTextObjects = [];
        }
      }
    });

    if (clipResult && typeof textBox.onClip === "function") {
      // The callback may finish the page or start drawing on another one.
      flushTextLinks(this, linkAnnotations);
      textBox.onClip(this, clipResult);
    }
  }

  flushTextLinks(this, linkAnnotations);
  return this;
};

/**
 * Write pending text links before a callback can change the active page.
 * @private
 * @param {Recipe} recipe - The recipe instance.
 * @param {Object[]} annotations - Pending {url, left, bottom, width, height}
 *   links; emptied.
 * @returns {void}
 */
function flushTextLinks(recipe, annotations) {
  for (var annotation of annotations.splice(0)) {
    linkPdf(
      recipe,
      annotation.url,
      annotation.left,
      annotation.bottom,
      annotation.width,
      annotation.height,
    );
  }
}

/**
 * Lay out text objects in a text box: resolve padding and wrap, walk HTML
 * children (list bullets, numbering and indentation), split them into lines
 * and turn line breaks into line state.
 * @private
 * @param {Object[]} textObjects - The text layout objects.
 * @param {Object} textBox - The text box; wrap and padding are normalized in place.
 * @param {Object} pathOptions - The resolved text options.
 * @returns {{toWriteTextObjects: Object[], textHeight: number}} The laid-out
 *   runs and the total text height.
 * @throws {Error} If a font cannot be loaded.
 */
exports._layoutText = function _layoutText(textObjects, textBox, pathOptions) {
  let totalHeight = 0;
  // allow user to treat wrap as boolean
  if (textBox.wrap === true) {
    textBox.wrap = TextWrap.AUTO;
  } else if (textBox.wrap === false) {
    textBox.wrap = TextWrap.ELLIPSIS;
  }

  // Allows user to enter a single number which will be used for all text box sides,
  // or an array of values [top, right, bottom, left] with any combination of missing sides.
  // Default value for a missing side is the value of the text box's opposite side (see below).
  //
  //               padding[0]
  //   padding[3]              padding[1]
  //               padding[2]

  textBox.padding = Array.isArray(textBox.padding)
    ? textBox.padding
    : [textBox.padding];

  Object.assign(textBox, {
    paddingTop: textBox.padding[0],
    paddingRight:
      textBox.padding[1] !== undefined
        ? textBox.padding[1]
        : textBox.padding[0],
    paddingBottom:
      textBox.padding[2] !== undefined
        ? textBox.padding[2]
        : textBox.padding[0],
    paddingLeft:
      textBox.padding[3] !== undefined
        ? textBox.padding[3]
        : textBox.padding[1] !== undefined
          ? textBox.padding[1]
          : textBox.padding[0],
  });

  let firstLineHeight;
  let toWriteTextObjects = [];
  /** Reports whether a layout node contains text, not only line breaks. */
  const hasRenderableContent = (textObject) =>
    (textObject.value !== undefined &&
      textObject.value !== null &&
      textObject.value !== "") ||
    textObject.childs?.some(hasRenderableContent);
  /**
   * Finds the node laid out last that has more than spaces, after its
   * parents' text.
   * @param {Object[]} nodes - Layout nodes in drawing order.
   * @returns {Object|undefined} The node, or undefined when none has text.
   */
  const lastTextNode = (nodes) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const child =
        node.tag && node.childs?.length && lastTextNode(node.childs);
      if (child) return child;
      if (!node.lineBreak && /\S/.test(node.value ?? "")) return node;
    }
    return undefined;
  };
  // Only the call's last text and the spaces after it end its line, so the
  // spaces between its HTML elements stay when the call ends a flow.
  const lastText = lastTextNode(textObjects);
  let atEnd = !lastText;

  // Every object is laid out after the runs of an open flow, which each
  // result repeats; the first result keeps them and later ones drop them.
  const previousRuns = new Set(this._previousTextObjects);
  /** Adds laid-out objects, recording the first line height. */
  const addLaidOutObjects = (newToWriteObjects, paragraphHeight) => {
    toWriteTextObjects = [
      ...toWriteTextObjects,
      ...(toWriteTextObjects.length
        ? newToWriteObjects.filter((textObj) => !previousRuns.has(textObj))
        : newToWriteObjects),
    ];

    if (!firstLineHeight) {
      this._lineHeight = firstLineHeight = toWriteTextObjects[0].lineHeight;
      if (!this._firstLineHeight) {
        this._firstLineHeight = this._lineHeight; // used in textbox coordinate computation
      }
    }
    totalHeight += paragraphHeight;
  };

  /**
   * Lays out a layout node and then its HTML children, adding the runs.
   * @param {Object} textObject - The layout node; list markers, indents,
   *   sizes and styles are passed on to its children in place.
   * @returns {void}
   */
  // A run whose first word wraps ends the open line of a flow; the call's
  // later runs continue the line it wrapped onto instead.
  const wrappedLineIDs = new Map();
  const writeValue = (textObject) => {
    textObject.lineID = textObject.lineID || Date.now() * Math.random();
    textObject.lineID =
      wrappedLineIDs.get(textObject.lineID) ?? textObject.lineID;
    textObject.lineID =
      textObject.needsLineBreaker || textObject.lineBreak
        ? Date.now() * Math.random()
        : textObject.lineID;
    if (textObject.lineBreak) {
      // A line break lays out as one empty line sized like its text; the
      // normalization below turns it into line state, never into text.
      const { toWriteTextObjects: newToWriteObjects, paragraphHeight } =
        makeTextObjects(
          this,
          Object.assign({}, textObject, { value: "" }),
          pathOptions,
          textBox,
        );
      const lineBreak = newToWriteObjects[newToWriteObjects.length - 1];
      lineBreak.lineBreak = true;
      // Flowed text marks the last word of the previous line, so an empty
      // break line still carries one empty word.
      if (!lineBreak.wordsInLine.length) {
        lineBreak.wordsInLine.push(new Word("", pathOptions));
      }
      addLaidOutObjects(newToWriteObjects, paragraphHeight);
      return;
    }
    // Want to allow empty string to pass through. Undefined and null elements, stay out!
    if (textObject.value !== undefined && textObject.value !== null) {
      textObject.styles.color = textObject.styles.color
        ? this._transformColor(textObject.styles.color)
        : pathOptions.color;
      atEnd = atEnd || textObject === lastText;
      const { toWriteTextObjects: newToWriteObjects, paragraphHeight } =
        makeTextObjects(this, textObject, pathOptions, textBox, atEnd);
      addLaidOutObjects(newToWriteObjects, paragraphHeight);
      if (openLine?.lineComplete && textObject.lineID === openLine.lineID) {
        wrappedLineIDs.set(
          openLine.lineID,
          newToWriteObjects[newToWriteObjects.length - 1].lineID,
        );
      }
    }
    if (textObject.tag && textObject.childs.length) {
      // console.log(textObject);
      if (!textObject.size) {
        textObject.size = pathOptions.size * textObject.sizeRatio;
        textObject.sizeRatios = [textObject.sizeRatio];
      }
      textObject.layer = textObject.layer || 0;
      textObject.layer++;

      textObject.currentIndex = 0;
      let prependValue = textObject.prependValue;

      const tag = (textObject.tag || "").toLowerCase();
      textObject.childs.forEach((child) => {
        const childTag = (child.tag || "").toLowerCase();
        if (tag === HtmlTag.UL) {
          child.prependValue = "* ";
          child.layer = textObject.layer + 1;
          // child.indent = 4 * child.layer;
        }
        if (tag === HtmlTag.OL) {
          if (childTag !== HtmlTag.OL) {
            textObject.currentIndex++;
            child.prependValue = `${textObject.currentIndex.toString()}. `;
          }
          child.layer = textObject.layer + 1;
          // child.indent = 4 * child.layer;
        }
        if (tag === HtmlTag.LI) {
          if (childTag === HtmlTag.OL || childTag === HtmlTag.UL) {
            child.layer = textObject.layer - 1;
          }
        }
        if (
          prependValue &&
          ![HtmlTag.OL, HtmlTag.UL].includes(childTag) &&
          hasRenderableContent(child)
        ) {
          child.prependValue = prependValue;
          prependValue = null;
          textObject.indent =
            tag === HtmlTag.LI
              ? 2 * textObject.layer
              : textObject.indent || 2 * textObject.layer;
        }
        if (textObject.indent) {
          child.indent = child.indent || textObject.indent;
        }
        if (textObject.size) {
          child.size = textObject.size * child.sizeRatio;
          child.sizeRatios = [...textObject.sizeRatios, child.sizeRatio];
        }
        child.styles = Object.assign(child.styles, textObject.styles);
        child.link = child.link || textObject.link;

        child.isBold = textObject.isBold ? textObject.isBold : child.isBold;
        child.isItalic = textObject.isItalic
          ? textObject.isItalic
          : child.isItalic;
        child.underline = textObject.underline
          ? textObject.underline
          : child.underline;
        child.strikeOut = textObject.strikeOut
          ? textObject.strikeOut
          : child.strikeOut;

        child.lineID = textObject.lineID;
        writeValue(child);
      });
    }
  };
  // Top-level nodes share a line, as children of a block element do, so
  // inline runs outside any element are not split onto separate lines. In a
  // flow they continue the line the previous run left open, unless both are
  // HTML and the previous one closed a block element or this one opens one.
  const openLine =
    this._previousTextObjects?.[this._previousTextObjects.length - 1];
  const topLevelLineID =
    openLine &&
    !openLine.lineComplete &&
    !(pathOptions.html && (this._flowEndsBlock || pathOptions.startsBlock))
      ? openLine.lineID
      : Date.now() * Math.random();
  textObjects.forEach((textObject) => {
    textObject.lineID = textObject.lineID || topLevelLineID;
    writeValue(textObject);
  });

  const normalizedTextObjects = [];
  let pendingBreaks = [];
  const replacementLineIDs = new Map();
  /** Converts pending line breaks into line state: blank lines and line IDs. */
  const appendPendingBreaks = (nextTextObject) => {
    const previous = normalizedTextObjects[normalizedTextObjects.length - 1];
    if (previous) previous.lineComplete = true;
    const blankBreaks =
      previous && nextTextObject ? pendingBreaks.slice(1) : pendingBreaks;
    blankBreaks.forEach((breakObject, index) => {
      normalizedTextObjects.push({
        ...breakObject,
        lineID: previous ? pendingBreaks[index].lineID : breakObject.lineID,
        text: "",
        // A later call of the flow lays the blank lines out again; they are
        // no longer breaks, and the last one is the line it continues.
        lineBreak: false,
        blankLine: true,
        lineComplete: !(
          this._flow &&
          !nextTextObject &&
          index === blankBreaks.length - 1
        ),
        lineWidth: 0,
        textWidth: 0,
      });
    });
    if (nextTextObject && previous) {
      replacementLineIDs.set(
        nextTextObject.lineID,
        pendingBreaks[pendingBreaks.length - 1].lineID,
      );
    }
    pendingBreaks = [];
  };
  toWriteTextObjects.forEach((textObject, index, objects) => {
    // Whitespace that only precedes a line break would start a blank line.
    const beforeLineBreak =
      !textObject.lineBreak &&
      !textObject.blankLine &&
      textObject.text.trim() == "" &&
      objects[index + 1]?.lineBreak;
    if (beforeLineBreak) return;
    if (textObject.lineBreak) {
      pendingBreaks.push(textObject);
      return;
    }
    if (pendingBreaks.length) appendPendingBreaks(textObject);
    textObject.lineID =
      replacementLineIDs.get(textObject.lineID) || textObject.lineID;
    normalizedTextObjects.push(textObject);
  });
  if (pendingBreaks.length) appendPendingBreaks();
  toWriteTextObjects = normalizedTextObjects;
  // Every line the call ends, ends with its last word, so its trailing
  // spaces do not widen it, as in Wasm. A flow's open line may continue
  // in a later call, and clipped text keeps its spaces.
  if (textBox.wrap !== TextWrap.CLIP) {
    toWriteTextObjects.forEach((textObj, index) => {
      const next = toWriteTextObjects[index + 1];
      if (next && next.lineID === textObj.lineID) return;
      if (this._flow && !next && !textObj.lineComplete) return;
      trimLineEnd(toWriteTextObjects, index);
    });
  }

  return {
    toWriteTextObjects: toWriteTextObjects,
    textHeight: getTextBoxHeight(toWriteTextObjects) || totalHeight,
  };
};

/**
 * Give the runs of each line one height and one baseline, so runs of
 * different sizes sit on the same baseline and the tallest one fits the
 * line.
 * @private
 * @param {Object[]} textObjs - The laid-out runs; updated in place.
 * @returns {void}
 */
function alignLineBaselines(textObjs) {
  // Runs without visible text, such as an empty run or the space before a
  // wrapped word, size only a line that has nothing else.
  const visibleLines = new Set(
    textObjs.filter(({ text }) => /\S/.test(text)).map(({ lineID }) => lineID),
  );
  const lines = new Map();
  for (const { lineID, lineHeight, baseline, text } of textObjs) {
    if (visibleLines.has(lineID) && !/\S/.test(text)) continue;
    const line = lines.get(lineID) || { lineHeight: 0, ascent: 0 };
    line.lineHeight = Math.max(line.lineHeight, lineHeight);
    // Each run's baseline offset is its line height less its ascent.
    line.ascent = Math.max(line.ascent, lineHeight - baseline);
    lines.set(lineID, line);
  }
  for (const textObj of textObjs) {
    const line = lines.get(textObj.lineID);
    textObj.lineHeight = line.lineHeight;
    textObj.baseline = line.lineHeight - line.ascent;
  }
}

/**
 * The height of laid-out text: the sum of the line heights, counting each
 * line once.
 * @private
 * @param {Object[]} textObjs - The laid-out runs.
 * @returns {number} The text height.
 */
function getTextBoxHeight(textObjs) {
  let previousLineID;
  let height = 0;

  // The summation of each text line height determines text box height.
  // The last segment of a line holds the correct offset (influenced by moveDown)
  // so must traverse the list in reverse order.

  for (let index = textObjs.length - 1; index >= 0; index--) {
    const segment = textObjs[index];
    const { lineHeight, lineID } = segment;

    // Keep line segments from same line influencing box height
    if (previousLineID !== lineID) {
      let lineOffset = segment.lineOffset;
      height += lineHeight * lineOffset;
      previousLineID = lineID;
    }
  }

  return height;
}

/**
 * Keep the complete lines that fit a height.
 * @private
 * @param {Object[]} textObjs - The laid-out runs.
 * @param {number} availableHeight - The height available for text.
 * @returns {{textObjects: Object[], linesWritten: number, clipped: boolean,
 *   remainder: string}} The fitting runs, their line count, whether lines were
 *   dropped, and the dropped text with its line breaks.
 */
function clipTextToBox(textObjs, availableHeight) {
  const lines = [];
  let line = [];
  let lineID;

  textObjs.forEach((textObj) => {
    if (line.length && lineID !== textObj.lineID) {
      lines.push(line);
      line = [];
    }
    lineID = textObj.lineID;
    line.push(textObj);
  });

  if (line.length) {
    lines.push(line);
  }

  let usedHeight = 0;
  let linesWritten = 0;
  const visibleLines = [];
  for (const currentLine of lines) {
    const lastSegment = currentLine[currentLine.length - 1];
    const lineHeight = lastSegment.lineHeight * lastSegment.lineOffset;
    if (usedHeight + lineHeight > availableHeight) {
      break;
    }
    visibleLines.push(currentLine);
    usedHeight += lineHeight;
    linesWritten++;
  }

  const remainderLines = lines.slice(linesWritten);
  return {
    textObjects: visibleLines.flat(),
    linesWritten,
    clipped: remainderLines.length > 0,
    // Preserve line boundaries so a remainder can be written into another box.
    remainder: remainderLines
      .map((currentLine) => currentLine.map((textObj) => textObj.text).join(""))
      .join("\n"),
  };
}

/**
 * The PDF position of a text box, after its alignment offset.
 * @private
 * @param {Recipe} self - The recipe instance.
 * @param {Object} textBox - The laid-out text box.
 * @param {Object} pathOptions - The resolved text options.
 * @returns {number[]} The [x, y] PDF position.
 * @throws {TypeError} If no page is active.
 */
function getTextBoxPosition(self, textBox, pathOptions) {
  const { offsetX, offsetY } = self._getTextBoxOffset(textBox, pathOptions);
  const { nx, ny } = self._calibrateCoordinate(
    self.x,
    self.y,
    offsetX,
    offsetY,
  );
  return [nx, ny];
}

/**
 * Draw the text box border and background from its style.
 * @private
 * @param {Recipe} self - The recipe instance.
 * @param {number} nx - The PDF x of the box.
 * @param {number} ny - The PDF y of the first line.
 * @param {Object} textBox - The laid-out text box with its style.
 * @param {Object} pathOptions - The resolved text options, for rotation.
 * @returns {void}
 */
function drawTextBox(self, nx, ny, textBox, pathOptions) {
  const textBoxWidth = textBox.width; //+ textBox.paddingLeft + textBox.paddingRight;
  let borderRadius = textBox.style ? textBox.style.borderRadius : 0;
  if (borderRadius === true) {
    borderRadius = 5;
  }

  self.rectangle(
    nx,
    ny - textBox.height + self._firstLineHeight,
    textBoxWidth,
    textBox.height,
    Object.assign(textBox.style, {
      useGivenCoords: true,
      rotation: pathOptions.rotation,
      rotationOrigin: [pathOptions.originX, pathOptions.originY],
      borderRadius: borderRadius,
    }),
  );
}

/**
 * Justify text in a line.
 * @private
 * @param {number} left is position of left hand side of text box
 * @param {number} x is starting position for text placement
 * @param {Object[]} wto is a write object
 * @param {Object} textBox holds text box properties
 * @param {Function} [position] used to place given word at a postion on the line
 * @returns {number} The x where the next run on the line starts.
 */
function justify(left, x, wto, textBox, position) {
  // For some reason, textWidth is smaller than lineWidth. My suspicions lie in the fact
  // that spacing computations appear different depending on where the space is located.
  // What is noted though that if lineWidth is used in the calculations for text
  // justitification, the text goes passed the right boundary. Due to the vagary in space
  // computation, the final wrinkle to make sure the last word in the line smacks up against
  // the right side boundary is to perform a special computation on the last word positioning
  // relative to that right side bounds.
  const wordsInLine = wto.wordsInLine;
  const textWidth = wto.totalTextWidth ? wto.totalTextWidth : wto.textWidth;
  const spaceCount = wto.wordCount ? wto.wordCount - 1 : wordsInLine.length - 1;
  const spaceBetweenWords =
    spaceCount > 0
      ? (textBox.width -
          textBox.paddingLeft -
          textBox.paddingRight -
          textWidth) /
        spaceCount
      : 0;
  const boxEdge = left;
  const lineStart = left + textBox.paddingLeft;
  let word;

  const lastWordPosition = (word) => {
    return (
      boxEdge + textBox.width - textBox.paddingRight - word.dimensions.xMax
    );
  };

  // There is the possibility that only one word left on segmented line.
  if (wordsInLine.length === 1 && wordsInLine[0].last && x !== lineStart) {
    x = lastWordPosition(wordsInLine[0]);
  }

  for (let index = 0; index < wordsInLine.length; index++) {
    const nextWord = wordsInLine[index + 1];

    word = wordsInLine[index];
    position && position(word, x);

    // Ready to compute last word spacing?
    if (nextWord && nextWord.last) {
      x = lastWordPosition(nextWord);
    } else {
      x += word.dimensions.xMax + spaceBetweenWords;
    }
  }

  // Supply caller with next available line position.
  // Checking to see if last word ended with a space or not
  // to compensate for text fragments that have not been
  // split on whitespace boundaries.
  return word.value.endsWith(" ") ? x : x - spaceBetweenWords;
}

/**
 * The word between the previous break and the next one.
 * @private
 * @param {string} text - The text being broken.
 * @param {Object} brk - The line break opportunity: position and required.
 * @param {number} previousPosition - The position of the previous break.
 * @param {Object} pathOptions - The resolved text options.
 * @param {boolean} [keepEnd=false] - Whether a required break drops only
 *   the line break, keeping the spaces before it, as clipped text does.
 * @returns {Word} The word; trimmed at a required break.
 */
function nextWord(text, brk, previousPosition, pathOptions, keepEnd = false) {
  let nextWord = text.slice(previousPosition, brk.position);

  if (brk.required) {
    // effectively saw a '\n' in text.
    nextWord = keepEnd
      ? nextWord.trimStart().replace(LINE_BREAK_END, "")
      : trimBreakableEnd(nextWord.trimStart());
  }

  return new Word(nextWord, pathOptions);
}

/**
 * Handle the first word that does not fit a line when wrapping is off: CLIP
 * keeps it for the clipping region, ELLIPSIS shortens it with "…", and TRIM
 * drops it.
 * @private
 * @param {Object} textBox - The text box with its wrap mode.
 * @param {Line} line - The full line; updated in place.
 * @param {Word} word - The word that did not fit.
 * @param {Object} pathOptions - The resolved text options.
 * @returns {void}
 */
function elideNonFittingText(textBox, line, word, pathOptions) {
  if (textBox.wrap === TextWrap.CLIP) {
    line.addWord(word);
  } else if (textBox.wrap === TextWrap.ELLIPSIS) {
    // This is more complicated than the other no-wrap options.
    // It makes an initial attempt to take the word that was
    // too big and make it shrink in size until it and the
    // ellipsis character fit. If that doesn't work, one more
    // attempt is taken by trying to shrink the previous word
    // that fit on the line.
    const ellipsis = "…";
    let usingPreviousWord = false;
    let tooBig = new Word(word.value.slice(0, -2) + ellipsis, pathOptions);

    while (!line.canFit(tooBig)) {
      if (tooBig.value.length > 1) {
        tooBig = new Word(tooBig.value.slice(0, -2) + ellipsis, pathOptions);

        // Try last word that fit in box?
      } else if (!usingPreviousWord) {
        tooBig = new Word(
          line.words.pop().value.slice(0, -1) + ellipsis,
          pathOptions,
        );
        usingPreviousWord = true;
      } else {
        break; // give up, only get 2 shots at this.
      }
    }

    line.addWord(tooBig);
  }
}

/**
 * Turn a finished line into a laid-out run and record the line.
 * @private
 * @param {Line[]} lines - The finished lines; the line is appended.
 * @param {Line} line - The line.
 * @param {number} lineID - The ID tying the first HTML line to its group.
 * @param {Object} textBox - The laid-out text box.
 * @param {Object} [options] - html, lastLine, lineComplete, wordCount,
 *   totalTextWidth and writeOptions.
 * @returns {Object} The run: text, line metrics and justification data.
 */
function makeTextObject(lines, line, lineID, textBox, options = {}) {
  const lineHeight = line.height;
  // Clipped text is measured with the spaces that end it, as in Wasm.
  const spaceSz =
    textBox.wrap !== TextWrap.CLIP &&
    options.lastLine &&
    line.lastWord &&
    line.lastWord.value.endsWith(" ")
      ? line.spaceWidth / 2
      : 0;
  let lid;

  if (!options.html) {
    lid = line.lineID;
  } else {
    // Use given lineID for very first line.
    // It helps to tie HTML lines together.
    lid = lines.length ? line.lineID : lineID;
  }

  lines.push(line);

  return {
    text: line.value,
    lineID: lid,
    lineHeight: lineHeight,
    lineOffset: 1,
    baseline: lineHeight - textBox.baselineHeight,
    lineWidth: line.currentWidth + spaceSz,
    textWidth: line.textWidth, // for justification
    spaceWidth: line.spaceWidth,
    wordsInLine: line.words,
    wordCount: options.wordCount || 0, // for justification
    totalTextWidth: options.totalTextWidth || 0,
    lastLine: options.lastLine === true,
    writeOptions: options.writeOptions,
    lineComplete: options.lineComplete === true,
  };
}

/**
 * Carry justification totals across runs that share a line.
 * @private
 * @param {Line} line - The line being finished.
 * @param {Object[]} textObjects - The runs laid out so far; updated in place.
 * @param {number} wordCount - The words counted so far on the line.
 * @param {number} totalTextWidth - The text width counted so far on the line.
 * @param {boolean} [ends=true] - Whether the line ends here. A line that a
 *   later flowed run continues keeps the space after its last word.
 * @returns {number[]} The updated [wordCount, totalTextWidth].
 */
function bindTextToLine(
  line,
  textObjects,
  wordCount,
  totalTextWidth,
  ends = true,
) {
  // Apply justification information to previous text objects.
  if (wordCount > 0) {
    if (ends) line.markLastWord();
    wordCount += line.words.length;
    totalTextWidth += line.textWidth;

    // If the previous text does not end with a space and
    // the text on the line does not start with a space then
    // assuming that the input was split across the word so
    // we want to decrement the number of words in the line
    // for the proper space calculation when justifying text.
    // For example, 'justif' --- 'ying'.
    const previousLine = textObjects[textObjects.length - 1];

    if (
      !previousLine.text.endsWith(" ") &&
      line.words[0] &&
      !line.words[0].value.startsWith(" ")
    ) {
      wordCount--;
    }

    line.lineID = previousLine.lineID; // associate this line with previous one

    for (let i = textObjects.length - 1; i >= 0; i--) {
      let textObj = textObjects[i];
      if (textObj.lineID !== line.lineID) {
        break;
      }
      textObj.wordCount = wordCount;
      textObj.totalTextWidth = totalTextWidth;
    }
  }
  return [wordCount, totalTextWidth];
}

/**
 * Break one text layout object into lines that fit the text box, continuing
 * any unfinished flowed lines.
 * @private
 * @param {Recipe} self - The recipe instance.
 * @param {Object} [textObject] - The text layout object.
 * @param {Object} pathOptions - The resolved text options.
 * @param {Object} [textBox] - The text box; line and baseline heights are set in place.
 * @param {boolean} [atEnd=true] - Whether only spaces follow the object in
 *   its call, so its line ends with the call when the call ends a flow.
 * @returns {{toWriteTextObjects: Object[], paragraphHeight: number}} The runs,
 *   including the carried-over flowed ones, and the paragraph height.
 * @throws {Error} If the font cannot be loaded.
 */
function makeTextObjects(
  self,
  textObject = {},
  pathOptions,
  textBox = {},
  atEnd = true,
) {
  const toWriteTextObjects = [...self._previousTextObjects];
  let text =
    (textObject.prependValue ? textObject.prependValue : "") +
    textObject.value +
    (textObject.appendValue ? textObject.appendValue : "");

  const size = textObject.size || pathOptions.size;
  // Use the same string to get the same height for each string with the same font.
  // Need lowercase 'gjpqy' so descenders are included in text height.
  // Need special characters '|}' because they have ascenders that go beyond upper case letters.
  const textDimensions = pathOptions.font.calculateTextDimensions(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZgjpqy|}",
    size,
  );
  const textHeight = textDimensions.height;

  pathOptions.textHeight = textHeight;
  textBox.lineHeight = textBox.lineHeight || textHeight;
  textBox.baselineHeight = textDimensions.yMax;

  const [alignHorizontal, alignVertical] = textBox.textAlign
    ? textBox.textAlign.split(" ")
    : [];
  const writeOptions = Object.assign({}, pathOptions, {
    link: textObject.link || pathOptions.link,
    color: textObject.styles.color,
    opacity: parseFloat(textObject.styles.opacity || pathOptions.opacity || 1),
    underline: textObject.underline || pathOptions.underline,
    strikeOut: textObject.strikeOut || pathOptions.strikeOut,
    // Text outside any HTML element has no inherited size of its own.
    size: size,
    alignHorizontal: alignHorizontal,
    alignVertical: alignVertical,
    font: self._getFont(textObject),
  });

  const lineOpts = {
    html: pathOptions.html,
    writeOptions: writeOptions,
    more: self._flow,
  };

  const breaker = new LineBreaker(text);
  const lines = [];
  const indent = textObject.indent || 0;

  const lineMaxWidth = textBox.width
    ? textBox.width - textBox.paddingLeft - textBox.paddingRight
    : null;
  // Clipped text keeps the spaces that end its lines, as in Wasm.
  const keepLineEnd = textBox.wrap === TextWrap.CLIP;
  let remainderWidth = lineMaxWidth;
  let newLine;
  let last = 0;
  let bk = breaker.nextBreak();
  let previousWord;
  let flushLine = false;
  let wordCount = 0; // for justification
  let totalTextWidth = 0; // for justification
  let textLine = "";
  let lineID = textObject.lineID;
  let lineHeight =
    textHeight > textBox.lineHeight ? textHeight : textBox.lineHeight;

  // An empty flowed run that leaves its line open has no words to join, so
  // it is dropped and the next run starts that line instead of a new one.
  while (
    toWriteTextObjects.length > 0 &&
    toWriteTextObjects[toWriteTextObjects.length - 1].text === "" &&
    !toWriteTextObjects[toWriteTextObjects.length - 1].lineComplete &&
    !toWriteTextObjects[toWriteTextObjects.length - 1].blankLine
  ) {
    toWriteTextObjects.pop();
  }

  // When text flow is involved, there may be lines that are
  // incomplete. So need to determine previous line word count
  // and remove last line marks because more text is being processed.
  if (toWriteTextObjects.length > 0) {
    let lineWidth = 0;
    const end = toWriteTextObjects.length - 1;
    const previousLine = toWriteTextObjects[end];
    let lineComplete, fini;

    if (
      !self._flow &&
      !textObject.lineBreak &&
      (text === "" || (!pathOptions.html && /^[^\S\n]+$/.test(text)))
    ) {
      // turning off flow with empty text so
      previousLine.lastLine = true; // need to make previous line, the last.
      // The flow's line ends with its last run with text, as when a run with
      // text ends the flow.
      if (!previousLine.lineComplete) trimLineEnd(toWriteTextObjects, end);
    }

    for (let i = end; i >= 0; i--) {
      let textObj = toWriteTextObjects[i];

      // only collect data while lineID's match.
      if (textObj.lineID !== previousLine.lineID) {
        break;
      }
      textLine = textObj.text + textLine;
      totalTextWidth += textObj.textWidth;
      // Each run is drawn after the one before it, plus a space after a run
      // that ends with one.
      lineWidth +=
        textObj.lineWidth +
        (textObj.text.endsWith(" ") ? textObj.spaceWidth : 0);
      if (i === end) {
        fini = lineComplete = textObj.lineComplete;
      } else {
        fini = textObj.lineComplete;
      }
      // An empty flowed run has no words.
      textObj.wordsInLine[textObj.wordsInLine.length - 1]?.lastWord(fini);
    }

    if (lineComplete) {
      totalTextWidth = 0;
    } else if (textLine) {
      wordCount = textLine.trim().split(/\s+/).length;
      remainderWidth = lineMaxWidth - lineWidth;
    }
  }

  newLine = new Line(remainderWidth, lineHeight, size, pathOptions);
  newLine.indent(indent);

  while (bk) {
    let word = nextWord(text, bk, last, pathOptions, keepLineEnd);

    if (newLine.canFit(word)) {
      newLine.addWord(word);
    } else {
      // Protect against line width being too small to accept any
      // word, which may also happen during text justification.
      if (newLine.words.length === 0) {
        // self.movedown(); // start at front of next line.
        if (wordCount > 0) {
          // no words applied to previous segment, so drop word count
          // and mark last word of previous line in case justifying.
          wordCount = 0;
          totalTextWidth = 0;
          trimLineEnd(toWriteTextObjects, toWriteTextObjects.length - 1);
          markLineComplete(toWriteTextObjects);
          // The word wraps, so an HTML run's first line is a new line, not
          // the open one it would have continued.
          lineID = newLine.lineID;
        }
      } else {
        // remove any trailing space on previous word so right justification works appropriately
        if (previousWord && textBox.wrap === TextWrap.AUTO) {
          newLine.replaceLastWord(
            trimBreakableEnd(previousWord.value.trimStart()),
          );
        }

        [wordCount, totalTextWidth] = bindTextToLine(
          newLine,
          toWriteTextObjects,
          wordCount,
          totalTextWidth,
        );

        toWriteTextObjects.push(
          makeTextObject(
            lines,
            newLine,
            lineID,
            textBox,
            Object.assign({}, lineOpts, {
              wordCount: wordCount,
              totalTextWidth: totalTextWidth,
              lineComplete: true,
            }),
          ),
        );
        // The line may end with this run's spaces, after earlier runs.
        // Clipped and ellipsized lines continue with the word that does
        // not fit, so they keep the space before it.
        if (textBox.wrap === TextWrap.AUTO) {
          trimLineEnd(toWriteTextObjects, toWriteTextObjects.length - 1);
        }
        wordCount = 0;
        totalTextWidth = 0;
      }

      // now deal with text line wrap (what happens to text that doesn't fit in line)
      if (textBox.wrap !== TextWrap.AUTO) {
        flushLine = true;
        elideNonFittingText(textBox, newLine, word, pathOptions);

        if (toWriteTextObjects.length > 0) {
          toWriteTextObjects[toWriteTextObjects.length - 1].text =
            newLine.value;
        } else {
          // this is the first line in the box (no other line yet emitted) ...
          toWriteTextObjects.push(
            makeTextObject(
              lines,
              newLine,
              lineID,
              textBox,
              Object.assign({}, lineOpts, {
                lineComplete: true,
              }),
            ),
          );
        }
      } else {
        // this is the auto wrap section
        newLine = new Line(lineMaxWidth, lineHeight, size, pathOptions);
        newLine.indent(indent);

        if (textObject.prependValue) {
          const space = Array(textObject.prependValue.length + 1)
            .fill(" ")
            .join("");
          newLine.addWord(new Word(space, pathOptions));
        }
        // A wrapped line starts with its first word, without the spaces
        // that started the run before it wrapped.
        const wrapped = word.value.replace(/^[^\S\u00a0]+/, "");
        if (wrapped) {
          newLine.addWord(
            wrapped === word.value ? word : new Word(wrapped, pathOptions),
          );
        }
      }
    }

    if (flushLine) {
      while (bk) {
        if (bk.required) {
          flushLine = false;
          newLine = new Line(lineMaxWidth, lineHeight, size, pathOptions);
          word = null;
          break;
        }
        bk = breaker.nextBreak();
      }
    } else {
      /**
       * Author: silverma (Marc Silverman)
       * #29 Is it possible to add multi-line text?
       * https://github.com/chunyenHuang/hummusRecipe/issues/29
       */
      if (bk.required) {
        toWriteTextObjects.push(
          makeTextObject(
            lines,
            newLine,
            lineID,
            textBox,
            Object.assign({ lineComplete: true, lastLine: true }, lineOpts),
          ),
        );
        markLineComplete(toWriteTextObjects, null, keepLineEnd);
        newLine = new Line(lineMaxWidth, lineHeight, size, pathOptions);
      }
    }

    if (bk) {
      previousWord = word;
      last = bk.position;
      bk = breaker.nextBreak();
    }
  }

  let isLastLine = alignHorizontal === TextAlign.JUSTIFY && !self._flow;

  if (!flushLine) {
    [wordCount, totalTextWidth] = bindTextToLine(
      newLine,
      toWriteTextObjects,
      wordCount,
      totalTextWidth,
      !self._flow && atEnd,
    );

    toWriteTextObjects.push(
      makeTextObject(
        lines,
        newLine,
        lineID,
        textBox,
        Object.assign({}, lineOpts, {
          wordCount: wordCount,
          totalTextWidth: totalTextWidth,
          lastLine: isLastLine,
        }),
      ),
    );
  } else {
    toWriteTextObjects[toWriteTextObjects.length - 1].lastLine = isLastLine;
  }

  let paragraphHeight =
    lineHeight * lines.length + textBox.paddingTop + textBox.paddingBottom;

  return {
    toWriteTextObjects,
    paragraphHeight,
  };
}

/**
 * Drop the spaces that end a line, back to its last word: the line's runs of
 * only spaces become empty, and the run with its last word loses the spaces
 * after it, as the last run of a line does. Non-breaking spaces stay.
 * @private
 * @param {Object[]} textObjs - The laid-out runs; the line's are updated in place.
 * @param {number} end - The index of the line's last run.
 * @returns {void}
 */
function trimLineEnd(textObjs, end) {
  const { lineID } = textObjs[end];
  for (let i = end; i >= 0; i--) {
    const run = textObjs[i];
    if (run.lineID !== lineID || (i < end && run.lineComplete)) break;
    const lastWord = run.wordsInLine[run.wordsInLine.length - 1];
    const trimmed = trimBreakableEnd(run.text);
    if (lastWord && trimmed !== run.text) {
      lastWord.lastWord();
      run.text = trimmed;
      run.lineWidth = trimmed
        ? new Word(trimmed, run.writeOptions).dimensions.xMax
        : 0;
    }
    if (run.text) break;
  }
}

/**
 * Mark the last run as ending its line: trim it, mark its last word and
 * optionally move the next line down.
 * @private
 * @param {Object[]} toWriteTextObjects - The runs; the last one is updated.
 * @param {number|null} [lines=null] - The line offset for the next line.
 * @param {boolean} [keepEnd=false] - Whether the run keeps the spaces that
 *   end it, as clipped text does.
 * @returns {void}
 */
function markLineComplete(toWriteTextObjects, lines = null, keepEnd = false) {
  // Get last element in text objects and mark it.
  const textObj = toWriteTextObjects[toWriteTextObjects.length - 1];
  const lastWordIdx = textObj.wordsInLine.length - 1;
  const alreadyComplete = textObj.lineComplete;

  // An empty flowed run has no words.
  textObj.wordsInLine[lastWordIdx]?.lastWord();
  textObj.text = textObj.text.trimStart();
  if (!keepEnd) textObj.text = trimBreakableEnd(textObj.text);
  textObj.lineComplete = true;

  if (lines) {
    // Ending a line that already ended adds blank lines, as one movedown()
    // with the summed count does.
    textObj.lineOffset = alreadyComplete
      ? (textObj.lineOffset || 1) + lines
      : lines;
  }
}

/**
 * Draw the open text flow, if any, as `text("", { flow: false })` would.
 * text() with coordinates, table(), and endPage() call it, so flowed text
 * that is never ended explicitly is still drawn.
 * @name _flushTextFlow
 * @function
 * @memberof Recipe#
 * @private
 * @returns {Recipe} The recipe instance.
 * @throws {Error} If an overflow callback names an undefined layout, or a font cannot be loaded.
 */
exports._flushTextFlow = function _flushTextFlow() {
  if (this._flow && this.pageContext && this._previousTextObjects?.length) {
    this.text("", { flow: false });
  }
  return this;
};

/** Move text positioning down N lines in text box
 * @name movedown
 * @function
 * @memberof Recipe#
 * @param {number} [lines=1] - the number of lines to reposition x and y coordinates
 * @param {Boolean} [returnCoords=false] - indicate whether or not to return [x,y] coordinates
 * @returns {Object|number[]} - when returnCoord false, the recipe object, when true, the new [x,y] coordinates.
 */
exports.movedown = function movedown(lines = 1, returnCoords = false) {
  if (!this._flow || this._previousTextObjects.length === 0) {
    this._previousTextObjects = [];
    // Before any text is written there is no cursor or line height yet.
    this.y =
      (this.y || 0) +
      (this._lineHeight || this.current.defaultFontSize) * lines;
    this.x = this.box ? this.box.x : this.x || 0;
  } else {
    // This handles continuous text positioning
    markLineComplete(this._previousTextObjects, lines);
    this._previousTextObjects[this._previousTextObjects.length - 1].lastLine =
      true;
  }

  return returnCoords ? [this.x, this.y] : this;
};

/**
 * Move a column layout so its first column starts at a point, keeping the
 * column spacing.
 * @private
 * @param {Column[]} columns - The layout columns; updated in place.
 * @param {number} x - The new x of the first column.
 * @param {number} y - The new y of the first column.
 * @returns {void}
 */
function adjustcolumnPosition(columns, x, y) {
  const ydiff = y - columns[0].y;
  for (const column of columns) {
    column.position = [x, column.y + ydiff];
    x += column.width + column.gap;
  }
}

/**
 * Define text column layout
 * @name layout
 * @function
 * @memberof Recipe#
 * @param {number|string} id - The identifier to be associated with the layout. (See 'text' layout option)
 * @param {number} [x] - The coordinate x used to position text columns on page. When zero or omitted, left margin used.
 * @param {number} [y] - The coordinate y used to position text columns on page. When zero or omitted, top margin used.
 * @param {number} [width] - The width of a text column. When zero or omitted, space between left and right margin used.
 * @param {number} [height] - The height of a text column. When zero or omitted, space between top and bottom margin used.
 * @param {object} [options] - The options.
 * @param {number} [options.columns] - Represents the number of columns in which to divide the given width.
 * @param {number} [options.gap=18] - Defines the separation between layout columns, units in points.
 * @param {boolean} [options.reset] - True indicates that the a new layout should be produced for the given
 * layout id, so any previous layout associated with the given id will be lost.
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If width or height is omitted while no page is active.
 */
exports.layout = function layout(id, x, y, width, height, options = {}) {
  this._layouts = this._layouts || {};
  this._layouts[id] = this._layouts[id] || [];

  if (options.reset) {
    this._layouts[id] = [];
  }

  if (!x) {
    x = this._margin.left;
  }
  if (!y) {
    y = this._margin.top;
  }
  if (!width) {
    width = this.page.mediaBox[2] - x - this._margin.right;
  }
  if (!height) {
    height = this.page.mediaBox[3] - y - this._margin.bottom;
  }

  if (!options.columns) {
    this._layouts[id].push(new Column(x, y, width, height));

    // columns as a simple number drives the text multiple columns feature
  } else if (typeof options.columns === "number") {
    const columns = options.columns;
    const gap = options.gap || 18;
    width = width / columns - gap / 2;

    for (let i = 0; i < options.columns; i++) {
      const column = new Column(x, y, width, height);
      column.gap = gap;
      this._layouts[id].push(column);
      x += width + gap;
    }
    // columns as an array drives the table feature (internal not documented for user)
  } else if (Array.isArray(options.columns)) {
    for (let i = 0; i < options.columns.length; i++) {
      let element = options.columns[i];
      width = element.width || 100;
      const column = new Column(
        x,
        y,
        width,
        height,
        element.text,
        element.name,
        element,
      );
      this._layouts[id].push(column);
      x += width;
    }
  }

  return this;
};
