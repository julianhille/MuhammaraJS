/** Calculates total character spacing for non-whitespace text. */
export function charSpacing(text, charSpace = 0) {
  var trimmed = String(text).trim();
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
