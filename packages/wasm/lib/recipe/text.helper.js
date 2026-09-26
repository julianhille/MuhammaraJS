/**
 * Calculates spacing between retained Unicode characters.
 * @param {string} text - Text.
 * @param {number} [charSpace=0] - Spacing per character gap.
 * @returns {number} Total spacing.
 */
export function charSpacing(text, charSpace = 0) {
  var characterCount = Array.from(String(text)).length;
  return characterCount ? (characterCount - 1) * charSpace : 0;
}

/** A measurable text fragment used by Recipe layout. */
export class Word {
  constructor(value, measure, options) {
    this.value = value;
    this.measure = measure;
    this.options = options;
  }
  /**
   * Measures the word including character spacing.
   * @returns {number} The width in points.
   */
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
 * the 14pt default, rejecting sizes that are not greater than zero before they
 * reach a measuring or drawing call. Zero and negative sizes produce no
 * readable output and nonsensical font metrics, so they are reported as invalid
 * input naming the option and the value. Omitting both options, or passing
 * `null` or `undefined`, selects the default.
 *
 * @param {object} [options] - Text options holding `fontSize` or `size`.
 * @returns {number} The resolved font size in PDF points.
 * @throws {RangeError} If the given size is not greater than zero.
 */
export function resolveFontSize(options = {}) {
  var name = options.fontSize == null ? "size" : "fontSize";
  var size = options[name];
  if (size == null) {
    return 14;
  }
  if (!(size > 0)) {
    throw new RangeError(
      `Text ${name} must be a number greater than zero, received ${size}`,
    );
  }
  return size;
}
