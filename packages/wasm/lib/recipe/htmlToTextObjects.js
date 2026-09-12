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
  var markerPending = false;
  var pendingReset = false;
  var tags = /<\/?[^>]+>|[^<]+/g;
  var match;
  var current = () => Object.assign({}, ...frames.map((frame) => frame.style));
  var push = (object) => {
    if (pendingReset) {
      object.indent = 0;
      pendingReset = false;
    }
    objects.push(object);
  };
  var lineBreak = (force = false) => {
    if (
      objects.length &&
      (force || objects[objects.length - 1].value !== "\n")
    ) {
      push({ value: "\n", styles: current() });
    }
    markerPending = false;
  };
  var pushItem = (item) => {
    push({ value: item.value, indent: item.indent, styles: current() });
    markerPending = true;
  };
  // HTML5 allows omitting </li>, so an item also ends when its sibling or its
  // list does. Without this, later content would inherit a stale marker.
  var closeItems = (depth) => {
    while (items.length && items[items.length - 1].depth >= depth) items.pop();
  };
  var continuePendingItem = () => {
    if (!pendingBoundary) return;
    lineBreak();
    var item = items[items.length - 1];
    if (item) pushItem(item);
    pendingBoundary = false;
  };
  while ((match = tags.exec(String(html)))) {
    var token = match[0];
    if (!token.startsWith("<")) {
      var currentItem = items[items.length - 1];
      if (
        !token.trim() &&
        (pendingBoundary ||
          markerPending ||
          (lists.length && currentItem?.depth !== lists.length))
      )
        continue;
      continuePendingItem();
      var value = token
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"');
      if (value) {
        push({ value, styles: current() });
        markerPending = false;
      }
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
        closeItems(lists.length + 1);
        pendingBoundary = true;
        if (!lists.length) pendingReset = true;
      }
      continue;
    }
    // Native propagates the marker into block children, so an opening block
    // right after one stays on the marker's line instead of orphaning it.
    if (["p", "div"].includes(name) && !markerPending) {
      lineBreak(true);
    }
    if (name === "li") {
      var openItem = frames.length - 1;
      while (
        openItem >= 0 &&
        !(
          frames[openItem].name === "li" &&
          frames[openItem].depth === lists.length
        )
      )
        openItem--;
      if (openItem !== -1) frames.splice(openItem);
      closeItems(lists.length);
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
    frames.push({
      name,
      depth: lists.length,
      style: { ...style, font: options.font },
    });
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
        depth: lists.length,
      };
      items.push(item);
      pushItem(item);
    }
  }
  return objects;
}
