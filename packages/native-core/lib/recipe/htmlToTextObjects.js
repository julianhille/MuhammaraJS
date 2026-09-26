const DOMParser = require("@xmldom/xmldom").DOMParser;

// Lower-case names of the HTML elements the parser handles.
const HtmlTag = Object.freeze({
  HTML: "html",
  P: "p",
  LI: "li",
  UL: "ul",
  OL: "ol",
  H1: "h1",
  H2: "h2",
  H3: "h3",
  SMALL: "small",
  BR: "br",
  B: "b",
  STRONG: "strong",
  I: "i",
  EM: "em",
  U: "u",
  DEL: "del",
  A: "a",
});

/**
 * Convert HTML into Recipe text layout objects.
 * @name htmlToTextObjects
 * @function
 * @memberof Recipe#
 * @param {string} htmlCodes - The HTML source. Tag names are matched case-insensitively.
 * @param {Object} [options] - Text options used to initialize the objects.
 * @param {string} [options.font] - The font of every object.
 * @param {number} [options.size] - The base font size of every object.
 * @returns {Object[]} The parsed text layout objects: one per child node,
 *   each with its value, tag, style flags, link, font size ratio and childs.
 */
exports.htmlToTextObjects = function (htmlCodes, options = {}) {
  const nodes = new DOMParser().parseFromString(
    `<html>${htmlCodes}</html>`,
    "text/html",
  );
  const textObjects = parseNode(nodes, options).childs[0].childs;
  return textObjects;
};

/**
 * The font size multiplier of an element.
 * @private
 * @param {string} [tagName=''] - The element name, matched case-insensitively.
 * @returns {number} The multiplier; 1 for elements without one.
 */
function getFontSizeRatio(tagName = "") {
  const fontSizeRatio = {
    [HtmlTag.P]: 1, // 14px
    [HtmlTag.H1]: 2.57, // 36px
    [HtmlTag.H2]: 2.14, // 30px
    [HtmlTag.H3]: 1.71, // 24px
    [HtmlTag.SMALL]: 0.7,
    // h4: 1.12,
    // h5: 0.83,
    // h6: 0.75
  };
  const matched = fontSizeRatio[tagName.toLowerCase()];
  return matched ? matched : 1;
}

/**
 * Whether an element starts its content on a new line.
 * @private
 * @param {string} [tagName=''] - The element name, matched case-insensitively.
 * @returns {boolean} True for p, li and h1 to h3.
 */
function needsLineBreaker(tagName = "") {
  const lineBreakers = [
    HtmlTag.P,
    HtmlTag.LI,
    HtmlTag.H1,
    HtmlTag.H2,
    HtmlTag.H3,
  ];
  return lineBreakers.includes(String(tagName).toLowerCase());
}

/**
 * Reports whether text in `node` begins a visual line: after a line break or
 * block element, or at the start of a block. Only such text drops its
 * leading whitespace; text that follows inline content keeps one space.
 * @private
 * @param {Object} node - The DOM text node.
 * @returns {boolean} True when the text begins a visual line.
 */
function startsLine(node) {
  const previous = node.previousSibling;
  if (previous) {
    const tag = (previous.tagName || "").toLowerCase();
    return (
      tag === HtmlTag.BR ||
      needsLineBreaker(tag) ||
      [HtmlTag.UL, HtmlTag.OL].includes(tag)
    );
  }
  const parent = node.parentNode;
  const parentTag = (
    parent && parent.tagName ? parent.tagName : ""
  ).toLowerCase();
  if (
    !parent ||
    !parentTag ||
    parentTag === HtmlTag.HTML ||
    needsLineBreaker(parentTag)
  ) {
    return true;
  }
  return startsLine(parent);
}

/**
 * Whether an element makes its text bold.
 * @private
 * @param {string} [tagName=''] - The element name, matched case-insensitively.
 * @returns {boolean} True for b and strong.
 */
function isBoldTag(tagName = "") {
  const boldTags = [HtmlTag.B, HtmlTag.STRONG];
  return boldTags.includes(String(tagName).toLowerCase());
}

/**
 * Whether an element makes its text italic.
 * @private
 * @param {string} [tagName=''] - The element name, matched case-insensitively.
 * @returns {boolean} True for i and em.
 */
function isItalicTag(tagName = "") {
  const italicTags = [HtmlTag.I, HtmlTag.EM];
  return italicTags.includes(String(tagName).toLowerCase());
}

/**
 * Convert a DOM node and its children into a text layout object.
 * @private
 * @param {Object} node - The DOM node.
 * @param {Object} options - The htmlToTextObjects() options.
 * @returns {Object} The text layout object with its parsed childs.
 */
function parseNode(node, options) {
  const tag = (node.tagName || "").toLowerCase();
  const attributes = [];
  const styles = {};
  for (let i in node.attributes) {
    if (!isNaN(i)) {
      attributes.push({
        name: node.attributes[i].nodeName,
        value: node.attributes[i].nodeValue,
      });
      if (node.attributes[i].nodeName == "style") {
        const styleValues = node.attributes[i].nodeValue.split(";");
        styleValues.forEach((element) => {
          if (element && element != "") {
            element = element.split(":");
            const key = element[0];
            let value = element[1].replace(/ /g, "");
            if (key == "color") {
              if (value.search("rgb") > -1) {
                value = value
                  .replace(/rgba?\(/, "")
                  .replace(/\)/, "")
                  .split(",")
                  .map((item) => parseFloat(item));
                if (value.length > 3) {
                  styles["opacity"] = value.pop();
                }
              }
            }
            styles[key] = value;
          }
        });
      }
    }
  }
  let value = node.data ? node.data.replace(/^\s*/gm, "") : null;
  if (value !== null && /^\s/.test(node.data) && !startsLine(node)) {
    value = " " + value;
  }
  // Whitespace before a line break would only pad the end of the line.
  const next = node.nextSibling;
  if (
    value !== null &&
    next &&
    (next.tagName || "").toLowerCase() === HtmlTag.BR
  ) {
    value = value.replace(/\s+$/, "");
  }
  if (value && value.charCodeAt(0) == 8203) {
    // zero width space
    value = value.substring(1);
  }
  const parsedData = {
    value,
    tag: node.tagName,
    font: options.font,
    isBold: isBoldTag(node.tagName),
    isItalic: isItalicTag(node.tagName),
    underline: tag === HtmlTag.U,
    strikeOut: tag === HtmlTag.DEL,
    attributes,
    styles,
    needsLineBreaker: needsLineBreaker(node.tagName),
    // An explicit line break; text layout ends the current line here.
    lineBreak: tag === HtmlTag.BR,
    size: options.size,
    sizeRatio: getFontSizeRatio(node.tagName),
    sizeRatios: [getFontSizeRatio(node.tagName)],
    link:
      tag === HtmlTag.A
        ? (attributes.find((attribute) => attribute.name === "href") || {})
            .value || null
        : null,
    childs: [],
  };
  for (let num in node.childNodes) {
    parsedData.childs.push(parseNode(node.childNodes[num], options));
  }
  const ignoreValue = ["\n", "\n\n"];
  parsedData.childs = parsedData.childs.filter((item) => {
    return (
      item.tag ||
      (item.value && !ignoreValue.includes(item.value.replace(/ /g, "")))
    );
  });
  return parsedData;
}
