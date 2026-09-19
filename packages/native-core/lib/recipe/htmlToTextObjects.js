const DOMParser = require("@xmldom/xmldom").DOMParser;

/**
 * Convert HTML into Recipe text layout objects.
 * @name htmlToTextObjects
 * @function
 * @memberof Recipe#
 * @param {string} htmlCodes - The HTML source.
 * @param {Object} [options] - Text options used to initialize the objects.
 * @returns {Object[]} The parsed text layout objects.
 */
exports.htmlToTextObjects = function (htmlCodes, options = {}) {
  const nodes = new DOMParser().parseFromString(
    `<html>${htmlCodes}</html>`,
    "text/html",
  );
  const textObjects = parseNode(nodes, options).childs[0].childs;
  return textObjects;
};

function getFontSizeRatio(tagName = "") {
  const fontSizeRatio = {
    p: 1, // 14px
    h1: 2.57, // 36px
    h2: 2.14, // 30px
    h3: 1.71, // 24px
    small: 0.7,
    // h4: 1.12,
    // h5: 0.83,
    // h6: 0.75
  };
  const matched = fontSizeRatio[tagName.toLowerCase()];
  return matched ? matched : 1;
}

function needsLineBreaker(tagName = "") {
  const lineBreakers = ["p", "li", "h1", "h2", "h3"];
  return lineBreakers.includes(tagName);
}

/**
 * Reports whether text in `node` begins a visual line: after a line break or
 * block element, or at the start of a block. Only such text drops its
 * leading whitespace; text that follows inline content keeps one space.
 * @private
 */
function startsLine(node) {
  const previous = node.previousSibling;
  if (previous) {
    const tag = (previous.tagName || "").toLowerCase();
    return tag === "br" || needsLineBreaker(tag) || ["ul", "ol"].includes(tag);
  }
  const parent = node.parentNode;
  const parentTag = (
    parent && parent.tagName ? parent.tagName : ""
  ).toLowerCase();
  if (
    !parent ||
    !parentTag ||
    parentTag === "html" ||
    needsLineBreaker(parentTag)
  ) {
    return true;
  }
  return startsLine(parent);
}

function isBoldTag(tagName = "") {
  const boldTags = ["b", "strong"];
  return boldTags.includes(tagName);
}

function isItalicTag(tagName = "") {
  const italicTags = ["i", "em"];
  return italicTags.includes(tagName);
}

function parseNode(node, options) {
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
  if (value !== null && next && /^br$/i.test(next.tagName || "")) {
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
    underline: node.tagName == "u",
    strikeOut: node.tagName == "del",
    attributes,
    styles,
    needsLineBreaker: needsLineBreaker(node.tagName),
    // An explicit line break; text layout ends the current line here.
    lineBreak: /^br$/i.test(node.tagName || ""),
    size: options.size,
    sizeRatio: getFontSizeRatio(node.tagName),
    sizeRatios: [getFontSizeRatio(node.tagName)],
    link: node.tagName == "a" ? node.attributes[0].value : null,
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
