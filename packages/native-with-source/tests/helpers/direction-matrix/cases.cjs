// The direction test matrix shared by the native and Wasm Recipe tests. Each
// case draws on a 400 by 400 page with the "arial" font registered; both
// ends must draw it alike and keep its properties, see matrix.cjs.

var SIZE = 12;
var BOX = { width: 300 };

// Texts that exercise reordering, points, punctuation, numbers, Latin words
// and the spaces a line may or may not break at.
var TEXTS = {
  hebrew: "\u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd",
  pointed:
    "\u05e9\u05c1\u05b8\u05dc\u05d5\u05b9\u05dd \u05e2\u05d5\u05b9\u05dc\u05b8\u05dd",
  "pointed-period": "\u05e9\u05c1\u05b8\u05dc\u05d5\u05b9\u05dd.",
  "pointed-quotes": '"\u05e9\u05c1\u05b8\u05dc\u05d5\u05b9\u05dd"',
  "pointed-brackets": "(\u05e9\u05c1\u05b8\u05dc\u05d5\u05b9\u05dd)",
  "pointed-digit": "\u05d0\u05b8\u05d11 \u05de\u05d7\u05d9\u05e8 120",
  maqaf: "\u05d1\u05bc\u05b8\u05d0\u05be\u05dc\u05d5\u05b9",
  "sof-pasuq": "\u05d0\u05c3\u05d1\u05b0",
  mixed: "\u05e9\u05dc\u05d5\u05dd abc 12 (\u05e2\u05d5\u05dc\u05dd)",
  latin: "Hello, world 12",
  accented: "Cafe\u0301 \u05d0\u05d1",
  nbsp: "\u05e9\u05dc\u05d5\u05dd\u00a0\u05e2\u05d5\u05dc\u05dd abc",
  "figure-space": "\u05e9\u05dc\u05d5\u05dd\u200712 \u05e2\u05d5\u05dc\u05dd",
  "narrow-nbsp": "\u05e9\u05dc\u05d5\u05dd\u202f\u05e2\u05d5\u05dc\u05dd",
};

var DIRECTIONS = ["none", "auto", "rtl", "ltr"];
var CHAR_SPACES = [0, 3];
var ALIGNS = ["left", "right", "justify"];

var cases = [];

// One text() call: every text in every direction, alignment and spacing.
for (var [textName, text] of Object.entries(TEXTS)) {
  for (var direction of DIRECTIONS) {
    for (var charSpace of CHAR_SPACES) {
      for (var align of ALIGNS) {
        // Justified text wraps in a narrow box so its first line is
        // justified; the others fit one line.
        var width = align === "justify" ? 60 : BOX.width;
        cases.push({
          name: ["single", textName, direction, "cs" + charSpace, align].join(
            " ",
          ),
          // A one-line right-aligned run ends at the box's right edge.
          rightEdge: align === "right" ? 50 + width : undefined,
          options: { size: SIZE, direction, charSpace },
          draw: (function (text, direction, charSpace, align, width) {
            return function (recipe) {
              recipe.text(text, 50, 50, {
                font: "arial",
                size: SIZE,
                direction,
                charSpace,
                textBox: { width, textAlign: align },
              });
            };
          })(text, direction, charSpace, align, width),
        });
      }
    }
  }
}

// The breaks a flow or a line ends at, and what may follow them.
var BREAKS = {
  lf: "\n",
  crlf: "\r\n",
  cr: "\r",
  vt: "\v",
  ff: "\f",
  nel: "\u0085",
  ls: "\u2028",
  ps: "\u2029",
};
var AFTER_BREAK = {
  nothing: null,
  space: " ",
  nbsp: "\u00a0",
  "figure-space": "\u2007",
};

// Flows: a later run ends with a break, something may follow, and text
// written after the flow must start below it.
for (var [breakName, separator] of Object.entries(BREAKS)) {
  for (var [afterName, after] of Object.entries(AFTER_BREAK)) {
    for (var direction of ["none", "auto"]) {
      cases.push({
        name: ["flow-break", breakName, afterName, direction].join(" "),
        cursorBelow: true,
        draw: (function (separator, after, direction) {
          return function (recipe) {
            var options = { font: "arial", size: SIZE, direction };
            recipe
              .text("abc ", 50, 50, { ...options, flow: true, textBox: BOX })
              .text("\u05e9\u05dc\u05d5\u05dd" + separator, options);
            if (after !== null) recipe.text(after, options);
            recipe.text("", { ...options, flow: false }).text("after", options);
          };
        })(separator, after, direction),
      });
    }
  }
}

// Plain non-flowed text that ends with a break.
for (var [breakName, separator] of Object.entries(BREAKS)) {
  for (var direction of ["none", "auto"]) {
    cases.push({
      name: ["single-break", breakName, direction].join(" "),
      draw: (function (separator, direction) {
        return function (recipe) {
          recipe.text("\u05e9\u05dc\u05d5\u05dd" + separator, 50, 50, {
            font: "arial",
            size: SIZE,
            direction,
            textBox: { width: 200, textAlign: "right" },
          });
        };
      })(separator, direction),
    });
  }
}

// Flows that mix plain, HTML and empty runs, ended in different ways.
var FLOW_RUNS = {
  "plain-plain": [
    ["x", {}],
    [" \u05e2\u05d5\u05dc\u05dd", {}],
  ],
  "empty-plain": [
    ["", {}],
    [" \u05e2\u05d5\u05dc\u05dd", {}],
  ],
  "leading-space": [[" \u05e2\u05d5\u05dc\u05dd", {}]],
  "latin-leading-space": [["  body", {}]],
  "plain-html": [
    ["1 2 3", {}],
    ["<span> 4 5</span>", { html: true }],
    [" \u05e9\u05dc\u05d5\u05dd", { html: false }],
  ],
  "plain-html-attribute": [
    ["\u05e9\u05dc\u05d5\u05dd", {}],
    ["<span title='a>b'> \u05e2\u05d5\u05dc\u05dd</span>", { html: true }],
  ],
  "html-blocks": [
    ["<p>\u05e9\u05dc\u05d5\u05dd</p>", { html: true }],
    ["<p>abc def.</p>", { html: true }],
  ],
  "html-break-end": [
    ["123 (5) ", {}],
    ["<span>456</span><br>", { html: true }],
    ["\u05e9\u05dc\u05d5\u05dd", { html: false }],
  ],
  "html-waiting": [
    ["123 (5)<br>456 (7) ", { html: true }],
    ["\u05e9\u05dc\u05d5\u05dd", { html: false }],
  ],
  "isolate-waiting": [
    ["\u2067\u05e9\u05dc\u05d5\u05dd\u2069 ", {}],
    ["abc", { direction: "none" }],
  ],
};
var ENDINGS = ["end", "movedown"];
for (var [flowName, runs] of Object.entries(FLOW_RUNS)) {
  for (var ending of ENDINGS) {
    for (var direction of ["none", "auto"]) {
      for (var align of ["left", "right"]) {
        cases.push({
          name: ["flow", flowName, ending, direction, align].join(" "),
          // A flow that ends without a break leaves the cursor on its line.
          cursorBelow: ending === "movedown",
          draw: (function (runs, ending, direction, align) {
            return function (recipe) {
              var options = { font: "arial", size: SIZE, direction };
              runs.forEach(function ([text, runOptions], index) {
                var merged = { ...options, ...runOptions };
                if (index === 0) {
                  recipe.text(text, 50, 50, {
                    ...merged,
                    flow: true,
                    textBox: { width: 200, textAlign: align },
                  });
                } else recipe.text(text, merged);
              });
              if (ending === "movedown") recipe.movedown();
              recipe
                .text("", { ...options, flow: false })
                .text("after", options);
            };
          })(runs, ending, direction, align),
        });
      }
    }
  }
}

module.exports = { cases };
