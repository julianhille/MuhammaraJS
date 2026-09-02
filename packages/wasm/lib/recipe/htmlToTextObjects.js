// Deliberately small, DOM-free HTML subset so Recipe also works in Workers.
/** Converts supported HTML into styled Recipe text objects. */
export function htmlToTextObjects(html, options = {}) {
  var objects = [];
  var styles = [];
  var tags = /<\/?[^>]+>|[^<]+/g;
  var match;
  var current = () => Object.assign({}, ...styles);
  while ((match = tags.exec(String(html)))) {
    var token = match[0];
    if (!token.startsWith("<")) {
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
    if (["br", "p", "div", "li"].includes(name) && !closing) {
      if (objects.length) objects.push({ value: "\n", styles: current() });
      continue;
    }
    if (closing) {
      styles.pop();
      continue;
    }
    var style = {};
    if (["b", "strong"].includes(name)) style.bold = true;
    if (["i", "em"].includes(name)) style.italic = true;
    if (name === "u") style.underline = true;
    if (["s", "strike", "del"].includes(name)) style.strikeOut = true;
    var color = token.match(/(?:color|data-color)\s*=\s*["']?([^\s"'>;]+)/i);
    if (color) style.color = color[1];
    var css = token.match(/style\s*=\s*["']([^"']*)/i)?.[1] || "";
    var cssColor = css.match(/color\s*:\s*([^;]+)/i);
    if (cssColor) style.color = cssColor[1].trim();
    styles.push({ ...current(), ...style, font: options.font });
  }
  return objects;
}
