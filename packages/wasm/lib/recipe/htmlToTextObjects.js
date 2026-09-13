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
  var pendingReset = false;
  var source = String(html);
  var tags = /<\/?[^>]+>|[^<]+/g;
  var match;
  var current = () => Object.assign({}, ...frames.map((frame) => frame.style));
  var push = (object) => {
    if (pendingReset) {
      if (object.indent === undefined) object.indent = 0;
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
  };
  var pushItem = (item) => {
    push({ value: item.value, indent: item.indent, styles: current() });
    item.markerPending = false;
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
    if (item?.markerPending) pushItem(item);
    pendingBoundary = false;
  };
  while ((match = tags.exec(source))) {
    var token = match[0];
    if (!token.startsWith("<")) {
      var currentItem = items[items.length - 1];
      var remaining = source.slice(tags.lastIndex);
      var nextListIndex = remaining.search(/<(?:ul|ol)\b/i);
      var onlyFormattingBeforeList =
        nextListIndex !== -1 &&
        !remaining
          .slice(0, nextListIndex)
          .replace(/<[^>]+>/g, "")
          .trim();
      if (
        !token.trim() &&
        ((!objects.length && onlyFormattingBeforeList) ||
          pendingBoundary ||
          currentItem?.markerPending ||
          (lists.length && currentItem?.depth !== lists.length))
      )
        continue;
      var startsLine =
        pendingBoundary ||
        currentItem?.markerPending ||
        objects[objects.length - 1]?.value === "\n";
      continuePendingItem();
      var value = token
        .replace(/&nbsp;/gi, "\u00a0")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"');
      if (startsLine) value = value.replace(/^[ \t\r\n\f]+/, "");
      if (value) {
        currentItem = items[items.length - 1];
        if (currentItem?.markerPending) pushItem(currentItem);
        push({ value, styles: current() });
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
      var frame = frameIndex === -1 ? null : frames[frameIndex];
      if (frame) frames.splice(frameIndex);
      if (name === "li" && frame) {
        items.pop();
        pendingBoundary = false;
      }
      if (["p", "div"].includes(name) && frame) {
        var blockItem = items[items.length - 1];
        if (objects.length === frame.objectCount) {
          pendingBoundary = frame.pendingBoundary;
          if (blockItem) blockItem.markerPending = frame.markerPending;
        } else {
          pendingBoundary = true;
          if (blockItem) blockItem.markerPending = true;
        }
      }
      if (["ul", "ol"].includes(name) && frame) {
        lists.pop();
        closeItems(lists.length + 1);
        if (objects.length > frame.objectCount) {
          pendingBoundary = true;
          var parentItem = items[items.length - 1];
          if (parentItem) parentItem.markerPending = true;
          if (!lists.length) pendingReset = true;
        }
      }
      continue;
    }
    // Native propagates the marker into block children, so an opening block
    // right after one stays on the marker's line instead of orphaning it.
    var block = ["p", "div"].includes(name);
    var blockItem = block ? items[items.length - 1] : null;
    var blockState = block
      ? {
          objectCount: objects.length,
          pendingBoundary,
          markerPending: blockItem?.markerPending,
        }
      : {};
    if (block) {
      pendingBoundary = true;
      if (blockItem) blockItem.markerPending = true;
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
      ...blockState,
      objectCount: objects.length,
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
        markerPending: true,
      };
      items.push(item);
    }
  }
  return objects;
}
