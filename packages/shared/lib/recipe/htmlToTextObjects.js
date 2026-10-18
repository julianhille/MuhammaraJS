import { DOMParser } from "@xmldom/xmldom";

// HTML attribute and inline style names the parser reads.
const HtmlAttribute = Object.freeze({
  STYLE: "style",
  HREF: "href",
});
const CssProperty = Object.freeze({
  COLOR: "color",
  OPACITY: "opacity",
});

// CSS color functions whose components the parser reads.
const CssColorFunction = Object.freeze({
  RGB: "rgb",
});

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
  S: "s",
  STRIKE: "strike",
  A: "a",
  DIV: "div",
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
export const htmlToTextObjects = function (htmlCodes, options = {}) {
  let nodes;
  try {
    nodes = parseHtml(htmlCodes);
  } catch {
    // markup the XML parser rejects is read as browsers recover it, and
    // markup that still fails as its text, as Wasm Recipe always drew it
    try {
      nodes = parseHtml(closeOmittedListItems(htmlCodes));
    } catch {
      nodes = parseHtml(String(htmlCodes).replace(/<[^>]*>?/g, ""));
    }
  }
  const textObjects = parseNode(nodes, options).childs[0].childs;
  return textObjects;
};

/**
 * Parse HTML with the XML parser, without reporting the errors it recovers
 * from.
 * @private
 * @param {string} html - The HTML source.
 * @returns {Document} The parsed document, with the HTML in an `html` element.
 * @throws {Error} If the markup is not well-formed.
 */
function parseHtml(html) {
  return new DOMParser({ onError() {} }).parseFromString(
    `<html>${html}</html>`,
    "text/html",
  );
}

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
 * @returns {boolean} True for p, div, li and h1 to h3.
 */
function needsLineBreaker(tagName = "") {
  const lineBreakers = [
    HtmlTag.P,
    HtmlTag.DIV,
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
 * Layout objects whose text, or whose last child's, ended with a line feed.
 * @private
 */
const endsWithLineFeed = new WeakSet();

/**
 * Convert a DOM node and its children into a text layout object.
 * @private
 * @param {Object} node - The DOM node.
 * @param {Object} options - The htmlToTextObjects() options.
 * @returns {Object} The text layout object with its parsed childs. Text
 *   that ends with a line feed loses it; when inline content follows the
 *   text, or the inline element it ends, a `lineBreak: true` child follows,
 *   as a `<br>` would.
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
      if (node.attributes[i].nodeName === HtmlAttribute.STYLE) {
        const styleValues = node.attributes[i].nodeValue.split(";");
        styleValues.forEach((element) => {
          if (element && element != "") {
            element = element.split(":");
            const key = element[0];
            let value = element[1].replace(/ /g, "");
            if (key === CssProperty.COLOR) {
              if (value.search(CssColorFunction.RGB) > -1) {
                value = value
                  .replace(/rgba?\(/, "")
                  .replace(/\)/, "")
                  .split(",")
                  .map((item) => parseFloat(item));
                if (value.length > 3) {
                  styles[CssProperty.OPACITY] = value.pop();
                }
              }
            }
            styles[key] = value;
          }
        });
      }
    }
  }
  // HTML whitespace only: a no-break or em space is content.
  let value = node.data ? node.data.replace(/^[ \t\n\r\f]*/gm, "") : null;
  if (value !== null && /^[ \t\n\r\f]/.test(node.data) && !startsLine(node)) {
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
  // A line feed that ends the text is never drawn; the parent ends the line
  // there when inline content follows.
  const lineFeed = Boolean(value && /\S\s*\n\s*$/.test(value));
  if (lineFeed) value = value.replace(/\s*\n\s*$/, "");
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
    strikeOut: [HtmlTag.S, HtmlTag.STRIKE, HtmlTag.DEL].includes(tag),
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
        ? (
            attributes.find(
              (attribute) => attribute.name === HtmlAttribute.HREF,
            ) || {}
          ).value || null
        : null,
    childs: [],
  };
  if (lineFeed) endsWithLineFeed.add(parsedData);
  for (let num in node.childNodes) {
    const child = node.childNodes[num];
    const parsedChild = parseNode(child, options);
    parsedData.childs.push(parsedChild);
    const following = child.nextSibling;
    if (!following && endsWithLineFeed.has(parsedChild)) {
      endsWithLineFeed.add(parsedData);
    }
    if (
      endsWithLineFeed.has(parsedChild) &&
      following &&
      !needsLineBreaker(following.tagName) &&
      (following.tagName || "").toLowerCase() !== HtmlTag.BR
    ) {
      parsedData.childs.push(
        parseNode({ tagName: "BR", childNodes: [] }, options),
      );
    }
  }
  const ignoreValue = ["\n", "\n\n"];
  parsedData.childs = parsedData.childs.filter((item, index, items) => {
    // Whitespace right before a block draws no line of its own.
    const next = items[index + 1];
    if (next && BLOCK_TAGS.has(next.tag) && isBlankInline(item)) return false;
    return (
      item.tag ||
      (item.value && !ignoreValue.includes(item.value.replace(/ /g, "")))
    );
  });
  return parsedData;
}

// Elements that start a line of their own.
const BLOCK_TAGS = new Set([
  HtmlTag.P,
  HtmlTag.DIV,
  HtmlTag.LI,
  HtmlTag.UL,
  HtmlTag.OL,
  HtmlTag.H1,
  HtmlTag.H2,
  HtmlTag.H3,
]);

/**
 * Whether a parsed object draws nothing but HTML whitespace inline.
 * @private
 * @param {Object} item - A parsed text object.
 * @returns {boolean} True for whitespace text or an inline element of it.
 */
function isBlankInline(item) {
  if (!item.tag) return /^[ \t\n\r\f]*$/.test(item.value || "");
  return (
    !BLOCK_TAGS.has(item.tag) &&
    item.tag !== HtmlTag.BR &&
    (item.childs || []).every(isBlankInline)
  );
}

// Elements without an end tag.
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/**
 * Balance the tags of HTML as browsers recover them, so the XML parser reads
 * what a browser shows instead of throwing: an end tag ends everything opened
 * inside its element, an end tag without an open element is dropped, a `<p>`
 * or `<li>` ends an open element of its name, a `</ul>` or `</ol>` ends the
 * innermost list when no list of its name is open, and what is still open at
 * the end is ended there. It also drops markup declarations, processing
 * instructions and comments. It runs only on markup the XML parser rejects.
 * @private
 * @param {string} html - The HTML source.
 * @returns {string} The HTML with balanced tags.
 */
function closeOmittedListItems(html) {
  const open = [];
  const close = (from) =>
    open
      .splice(from)
      .reverse()
      .map((name) => `</${name}>`)
      .join("");
  const isList = (name) => name === HtmlTag.UL || name === HtmlTag.OL;
  html = String(html).replace(/<!--[\s\S]*?(?:-->|$)|<[!?][^>]*>?/g, "");
  const body = html.replace(
    /<(\/?)([a-zA-Z][\w:.-]*)\b(?:[^>"']|"[^"]*(?:"|$)|'[^']*(?:'|$))*(?:>|$)/g,
    (tag, closing, name) => {
      // an unterminated tag is left for the parser to reject
      if (!tag.endsWith(">")) return tag;
      name = name.toLowerCase();
      if (VOID_ELEMENTS.has(name)) return closing ? "" : tag;
      if (!closing) {
        const ends =
          (name === HtmlTag.LI || name === HtmlTag.P) && open.at(-1) === name;
        const prefix = ends ? close(open.length - 1) : "";
        if (!tag.endsWith("/>")) open.push(name);
        return prefix + tag;
      }
      let from = open.lastIndexOf(name);
      // A </li> ends an item of its own list only.
      if (name === HtmlTag.LI && from < open.findLastIndex(isList)) from = -1;
      if (from < 0 && isList(name)) from = open.findLastIndex(isList);
      return from < 0 ? "" : close(from);
    },
  );
  return body + close(0);
}

// Shared with text layout; non-enumerable so it is not a Recipe method.
export { HtmlTag };
