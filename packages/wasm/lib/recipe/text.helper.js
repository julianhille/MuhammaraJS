/** Calculates spacing between retained characters while preserving non-breaking spaces. */
export function charSpacing(text, charSpace = 0) {
  var trimmed = String(text).replace(
    /^(?:(?!\u00a0)\s)+|(?:(?!\u00a0)\s)+$/g,
    "",
  );
  return trimmed.length ? (trimmed.length - 1) * charSpace : 0;
}

/** A measurable text fragment used by Recipe layout. */
export class Word {
  constructor(value, measure, options) {
    this.value = value;
    this.measure = measure;
    this.options = options;
  }
  get width() {
    return (
      this.measure(this.value, this.options).width +
      charSpacing(this.value, this.options.charSpace)
    );
  }
}

/** A width-constrained collection of measurable text fragments. */
export class Line {
  constructor(width, measure, options) {
    this.width = width;
    this.measure = measure;
    this.options = options;
    this.words = [];
  }
  get value() {
    return this.words.join("");
  }
  get currentWidth() {
    return (
      this.measure(this.value, this.options).width +
      charSpacing(this.value, this.options.charSpace)
    );
  }
  canFit(value) {
    return (
      this.currentWidth + new Word(value, this.measure, this.options).width <=
      this.width
    );
  }
}

/** A rectangular text column used by Recipe layout. */
export class Column {
  constructor(x, y, width, height, text = "", field = "", options = {}) {
    Object.assign(this, {
      x,
      y,
      width,
      height,
      text: text || field,
      field,
      options,
      gap: 0,
    });
  }
  get position() {
    return [this.x, this.y];
  }
  set position(value) {
    [this.x, this.y] = value;
  }
}

/**
 * Resolves the font size for a text call from `fontSize`, its `size` alias, or
 * the 14pt default, rejecting negative values before they reach a measuring or
 * drawing call. A negative size produces nonsensical font metrics rather than
 * output, so it is reported as invalid input naming the option and the value.
 *
 * @param {object} [options] - Text options holding `fontSize` or `size`.
 * @returns {number} The resolved font size in PDF points.
 * @throws {RangeError} If the resolved size is negative.
 */
export function resolveFontSize(options = {}) {
  var size = options.fontSize || options.size || 14;
  if (size < 0) {
    throw new RangeError(
      `Text ${options.fontSize ? "fontSize" : "size"} must be a non-negative number, received ${size}`,
    );
  }
  return size;
}
