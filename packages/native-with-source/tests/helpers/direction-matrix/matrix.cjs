// Runs the direction test matrix of cases.cjs on one end, native or Wasm.
// Both ends draw every case, reduce it to its lines and annotations, and
// check it against expected.json, which holds the output of both ends: so
// each end keeps its own output, and a case both ends must draw alike fails
// once they differ. Each case's properties are checked too.
//
// Set UPDATE_DIRECTION_MATRIX=1 to write an end's current output into
// expected.json instead of checking it.

var fs = require("fs");
var path = require("path");
var { cases } = require("./cases.cjs");

var EXPECTED = path.join(__dirname, "expected.json");

// Cases whose output differs between the ends for reasons outside text
// direction, as on develop before right-to-left text; their properties are
// still checked, and each end must keep its own output.
var KNOWN_DIFFERENCES = [
  [
    /^flow plain-html-attribute /,
    "Wasm's HTML parser ends a tag at a '>' inside a quoted attribute",
  ],
  [
    /^flow html-blocks end /,
    "after a flow that ends with a closed block element, Wasm draws the next text on its last line",
  ],
  [
    /^single (mixed (none|ltr)|pointed-digit none) cs\d justify$/,
    "Wasm justifies a line drawn as given with slightly different gaps",
  ],
  [
    /^flow plain-html /,
    "native drops a space inside an HTML run's first element",
  ],
  [
    /^(flow-break \w+ figure-space|single-break nel) /,
    "native trims a figure space at a line's end and keeps a next line there",
  ],
];

/**
 * Reduce a drawn page to what both ends must agree on: the runs of each line
 * from top to bottom, with their text and x, and the horizontal extent of
 * each annotation. Line heights differ between the ends, so only the order
 * of lines counts.
 *
 * @param {Array<{text: string, x: number, y: number}>} runs The page's runs.
 * @param {number[][]} annotations Each annotation's [left, right].
 * @returns {{lines: Array<Array<[string, number]>>, annotations: number[][]}}
 *   The summary.
 */
function summarize(runs, annotations) {
  var ys = [...new Set(runs.map((run) => Math.round(run.y * 10) / 10))].sort(
    (a, b) => b - a,
  );
  return {
    lines: ys.map((y) =>
      runs
        .filter((run) => Math.round(run.y * 10) / 10 === y)
        .sort((a, b) => a.x - b.x)
        .map((run) => [run.text, Math.round(run.x * 100) / 100]),
    ),
    annotations: annotations.map((rect) =>
      rect.map((value) => Math.round(value * 10) / 10),
    ),
  };
}

/**
 * Check a case's properties on its summary.
 *
 * @param {object} testCase The case.
 * @param {ReturnType<typeof summarize>} summary Its summary.
 * @param {function(string, string, number): number} drawnRight Where the
 *   glyphs of a run drawn at x end: its text, direction and x.
 * @returns {string[]} The properties it breaks.
 */
function brokenProperties(testCase, summary, drawnRight) {
  var broken = [];
  if (testCase.cursorBelow) {
    // Text written after a flow that a break or movedown() ended starts
    // below every line that shows text of the flow.
    var after = summary.lines.findIndex((line) =>
      line.some(([text]) => text === "after"),
    );
    var lastShown = summary.lines.findLastIndex((line) =>
      line.some(([text]) => text !== "after" && text.trim() !== ""),
    );
    if (after <= lastShown) {
      broken.push("text after the flow is drawn on one of its lines");
    }
  }
  if (testCase.rightEdge !== undefined) {
    summary.lines.forEach((line, index) => {
      var visible = line.filter(([text]) => text.trim() !== "");
      if (!visible.length) return;
      var [text, x] = visible[visible.length - 1];
      var right = drawnRight(text.trimEnd(), testCase.options.direction, x);
      if (Math.abs(right - testCase.rightEdge) > 0.5) {
        broken.push(
          `line ${index} ends at ${right.toFixed(2)}, not at the right edge ${testCase.rightEdge}`,
        );
      }
    });
  }
  return broken;
}

/**
 * Read expected.json.
 *
 * @returns {Object<string, {native: object, wasm: object}>} The output of
 *   both ends by case name.
 */
function readExpected() {
  try {
    return JSON.parse(fs.readFileSync(EXPECTED, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

/**
 * Write one end's output into expected.json, keeping the other end's.
 *
 * @param {string} end "native" or "wasm".
 * @param {Object<string, object>} summaries The end's summary by case name.
 * @returns {void}
 */
function writeExpected(end, summaries) {
  var expected = readExpected();
  var written = {};
  cases.forEach((testCase) => {
    written[testCase.name] = {
      ...expected[testCase.name],
      [end]: summaries[testCase.name],
    };
  });
  fs.writeFileSync(EXPECTED, JSON.stringify(written, null, 1) + "\n");
}

/**
 * Why a case may differ between the ends, if it may.
 *
 * @param {string} name The case name.
 * @returns {string|undefined} The reason.
 */
function knownDifference(name) {
  var known = KNOWN_DIFFERENCES.find(([pattern]) => pattern.test(name));
  return known && known[1];
}

module.exports = {
  cases,
  summarize,
  brokenProperties,
  readExpected,
  writeExpected,
  knownDifference,
  update: process.env.UPDATE_DIRECTION_MATRIX === "1",
};
