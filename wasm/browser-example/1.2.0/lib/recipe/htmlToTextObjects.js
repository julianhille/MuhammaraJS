// Lower-case names of the HTML elements the parser handles, as native names
// them; DIV, S, and STRIKE are Wasm additions.
var HtmlTag = Object.freeze({
  HTML: "html",
  P: "p",
  DIV: "div",
  LI: "li",
  UL: "ul",
  OL: "ol",
  BR: "br",
  B: "b",
  STRONG: "strong",
  I: "i",
  EM: "em",
  U: "u",
  S: "s",
  STRIKE: "strike",
  DEL: "del",
  A: "a",
});

// Deliberately small, DOM-free HTML subset so Recipe also works in Workers.
/**
 * Converts the supported DOM-free HTML subset into styled Recipe fragments,
 * including inline formatting, links, colors, block breaks, and nested lists.
 * It does not draw or change Recipe state, and therefore does not interpret
 * page coordinates.
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
  var continuationIndent;
  var source = String(html);
  var firstListIndex = source.search(/<(?:ul|ol)\b/i);
  var voidElements = new Set([
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
    "param",
    "source",
    "track",
    "wbr",
  ]);
  var tags = /<\/?[^>]+>|[^<]+/g;
  var match;
  /**
   * Reports whether a token contains more than collapsible formatting whitespace.
   * @param {string} value - Token.
   * @returns {boolean} Whether it has text.
   */
  var hasText = (value) => /[^ \t\r\n\f\v]/.test(value);
  var onlyFormattingBeforeFirstList =
    firstListIndex !== -1 &&
    !hasText(source.slice(0, firstListIndex).replace(/<[^>]+>/g, ""));
  var leadingListStructure = onlyFormattingBeforeFirstList;
  /**
   * Combines the styles inherited from the currently open element frames.
   * @returns {object} The styles.
   */
  var current = () => Object.assign({}, ...frames.map((frame) => frame.style));
  /**
   * Appends a fragment while applying any pending reset after a closed list.
   * @param {object} object - Text object.
   * @returns {void}
   */
  var push = (object) => {
    if (pendingReset) {
      if (object.indent === undefined) object.indent = 0;
      pendingReset = false;
    }
    objects.push(object);
  };
  /**
   * Appends a styled newline, optionally preserving consecutive explicit breaks.
   * @param {boolean} [force=false] - Append even after another newline.
   * @returns {void}
   */
  var lineBreak = (force = false) => {
    if (
      objects.length &&
      (force || objects[objects.length - 1].value !== "\n")
    ) {
      push({ value: "\n", styles: current() });
    }
  };
  /**
   * Emits a pending list marker and clears its continuation state.
   * @param {{value: string, indent: number}} item - List item.
   * @returns {void}
   */
  var pushItem = (item) => {
    push({ value: item.value, indent: item.indent, styles: current() });
    item.markerPending = false;
    continuationIndent = undefined;
  };
  // HTML5 allows omitting </li>, so an item also ends when its sibling or its
  // list does. Without this, later content would inherit a stale marker.
  /**
   * Closes active list items at or below the given nesting depth.
   * @param {number} depth - List depth.
   * @returns {void}
   */
  var closeItems = (depth) => {
    while (items.length && items[items.length - 1].depth >= depth) items.pop();
  };
  /** Resolves a block boundary using the active item marker or continuation indent. */
  var continuePendingItem = () => {
    if (!pendingBoundary) return;
    lineBreak();
    var item = items[items.length - 1];
    if (item?.markerPending) pushItem(item);
    else if (item) continuationIndent = item.indent;
    pendingBoundary = false;
  };
  while ((match = tags.exec(source))) {
    var token = match[0];
    if (!token.startsWith("<")) {
      var currentItem = items[items.length - 1];
      if (
        !hasText(token) &&
        ((!objects.length && leadingListStructure) ||
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
        var object = { value, styles: current() };
        if (continuationIndent !== undefined) {
          object.indent = continuationIndent;
          continuationIndent = undefined;
        }
        push(object);
      }
      continue;
    }
    var closing = /^<\//.test(token);
    var name = token.match(/^<\/?\s*([\w-]+)/)?.[1]?.toLowerCase();
    if (name === HtmlTag.BR && !closing) {
      // An explicit break always ends a line, including an empty first line,
      // as in native Recipe.
      push({ value: "\n", styles: current() });
      continue;
    }
    if (closing) {
      var frameIndex = frames.length - 1;
      while (frameIndex >= 0 && frames[frameIndex].name !== name) frameIndex--;
      var frame = frameIndex === -1 ? null : frames[frameIndex];
      var removedFrames = frame ? frames.splice(frameIndex) : [];
      var removedListFrames = removedFrames.filter((removedFrame) =>
        [HtmlTag.UL, HtmlTag.OL].includes(removedFrame.name),
      );
      removedListFrames.forEach(() => lists.pop());
      if (
        removedFrames.some((removedFrame) => removedFrame.name === HtmlTag.LI)
      ) {
        closeItems(lists.length + 1);
      }
      if (name === HtmlTag.LI && frame) {
        items.pop();
        pendingBoundary = false;
      }
      if ([HtmlTag.P, HtmlTag.DIV].includes(name) && frame) {
        var blockItem = items[items.length - 1];
        if (objects.length === frame.objectCount) {
          pendingBoundary = frame.pendingBoundary;
          if (blockItem) blockItem.markerPending = frame.markerPending;
        } else {
          pendingBoundary = true;
        }
      }
      if (removedListFrames.length && name !== HtmlTag.LI) {
        closeItems(lists.length + 1);
        if (objects.length > removedListFrames[0].objectCount) {
          pendingBoundary = true;
          if (!lists.length) {
            pendingReset = true;
            continuationIndent = undefined;
          }
        }
      }
      continue;
    }
    // Native propagates the marker into block children, so an opening block
    // right after one stays on the marker's line instead of orphaning it.
    var block = [HtmlTag.P, HtmlTag.DIV].includes(name);
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
    }
    if (name === HtmlTag.LI) {
      var openItem = frames.length - 1;
      while (
        openItem >= 0 &&
        !(
          frames[openItem].name === HtmlTag.LI &&
          frames[openItem].depth === lists.length
        )
      )
        openItem--;
      if (openItem !== -1) frames.splice(openItem);
      closeItems(lists.length);
    }
    var style = {};
    if ([HtmlTag.B, HtmlTag.STRONG].includes(name)) style.bold = true;
    if ([HtmlTag.I, HtmlTag.EM].includes(name)) style.italic = true;
    if (name === HtmlTag.U) style.underline = true;
    if ([HtmlTag.S, HtmlTag.STRIKE, HtmlTag.DEL].includes(name))
      style.strikeOut = true;
    if (name === HtmlTag.A)
      style.link = token.match(/href\s*=\s*["']?([^\s"'>]+)/i)?.[1];
    var color = token.match(/(?:color|data-color)\s*=\s*["']?([^\s"'>;]+)/i);
    if (color) style.color = color[1];
    var css = token.match(/style\s*=\s*["']([^"']*)/i)?.[1] || "";
    var cssColor = css.match(/color\s*:\s*([^;]+)/i);
    if (cssColor) style.color = cssColor[1].trim();
    if (voidElements.has(name)) continue;
    frames.push({
      name,
      depth: lists.length,
      style: { ...style, font: options.font },
      ...blockState,
      objectCount: objects.length,
    });
    if ([HtmlTag.UL, HtmlTag.OL].includes(name)) {
      lists.push({ name, index: 0 });
    } else if (name === HtmlTag.LI) {
      lineBreak();
      pendingBoundary = false;
      var list = lists[lists.length - 1] || { name: HtmlTag.UL, index: 0 };
      list.index++;
      var item = {
        value: list.name === HtmlTag.OL ? `${list.index}. ` : "* ",
        indent: lists.length * 4 + 2,
        depth: lists.length,
        markerPending: true,
      };
      items.push(item);
    }
  }
  return objects;
}
