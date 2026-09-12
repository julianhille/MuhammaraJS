// Deliberately small, DOM-free HTML subset so Recipe also works in Workers.
/**
 * Converts supported HTML into styled objects consumed by Recipe text layout.
 * This DOM-free parser recognizes basic emphasis, links, colors, and line-break
 * elements. It does not draw or change Recipe state, and therefore does not
 * interpret page coordinates.
 *
 * @private
 * @param {string} html - HTML source to convert.
 * @param {Partial<RecipeTextOptions>} [options] - Initial text options, including the inherited font.
 * @returns {RecipeHtmlTextObject[]} Styled text fragments in source order.
 */
export function htmlToTextObjects(html, options = {}) {
  var objects = [];
  var frames = [];
  var lists = [];
  var items = [];
  var pendingBoundary = false;
  var tags = /<\/?[^>]+>|[^<]+/g;
  var match;
  var current = () => Object.assign({}, ...frames.map((frame) => frame.style));
  var lineBreak = (force = false) => {
    if (
      objects.length &&
      (force || objects[objects.length - 1].value !== "\n")
    ) {
      objects.push({ value: "\n", styles: current() });
    }
  };
  var continuePendingItem = () => {
    if (!pendingBoundary) return;
    lineBreak();
    var item = items[items.length - 1];
    if (item) objects.push({ ...item, styles: current() });
    pendingBoundary = false;
  };
  while ((match = tags.exec(String(html)))) {
    var token = match[0];
    if (!token.startsWith("<")) {
      if (pendingBoundary && !token.trim()) continue;
      continuePendingItem();
      var value = token
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"');
      if (value) objects.push({ value, styles: current() });
      continue;
    }
    var closing = /^<\//.test(token);
    var name = token.match(/^<\/?\s*([\w-]+)/)?.[1]?.toLowerCase();
    if (name === "br" && !closing) {
      lineBreak(true);
      continue;
    }
    if (closing) {
      var frameIndex = frames.length - 1;
      while (frameIndex >= 0 && frames[frameIndex].name !== name) frameIndex--;
      if (frameIndex !== -1) frames.splice(frameIndex);
      if (name === "li") {
        items.pop();
        pendingBoundary = false;
      }
      if (["ul", "ol"].includes(name)) {
        lists.pop();
        pendingBoundary = true;
      }
      continue;
    }
    if (["p", "div"].includes(name)) {
      lineBreak(true);
    }
    var style = {};
    if (["b", "strong"].includes(name)) style.bold = true;
    if (["i", "em"].includes(name)) style.italic = true;
    if (name === "u") style.underline = true;
    if (["s", "strike", "del"].includes(name)) style.strikeOut = true;
    if (name === "a")
      style.link = token.match(/href\s*=\s*["']?([^\s"'>]+)/i)?.[1];
    var color = token.match(/(?:color|data-color)\s*=\s*["']?([^\s"'>;]+)/i);
    if (color) style.color = color[1];
    var css = token.match(/style\s*=\s*["']([^"']*)/i)?.[1] || "";
    var cssColor = css.match(/color\s*:\s*([^;]+)/i);
    if (cssColor) style.color = cssColor[1].trim();
    frames.push({ name, style: { ...style, font: options.font } });
    if (["ul", "ol"].includes(name)) {
      lists.push({ name, index: 0 });
    } else if (name === "li") {
      lineBreak();
      pendingBoundary = false;
      var list = lists[lists.length - 1] || { name: "ul", index: 0 };
      list.index++;
      var item = {
        value: list.name === "ol" ? `${list.index}. ` : "* ",
        indent: 4 * lists.length + 2,
      };
      items.push(item);
      objects.push({ ...item, styles: current() });
    }
  }
  return objects;
}
