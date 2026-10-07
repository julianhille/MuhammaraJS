// Runs the direction test matrix on one end, native or Wasm. Each YAML file
// under cases/ is a scenario: its input, the variations it is drawn in, and
// the expected output of both ends for each variation. Both ends draw every
// variation, reduce it to its lines and annotations, and check it against
// the file: each end keeps its own output, and the ends must draw alike
// unless the variation names a known difference. Each case's properties are
// checked too.
//
// Set UPDATE_DIRECTION_MATRIX=1 to write an end's current output into the
// files instead of checking it.

var fs = require("fs");
var path = require("path");
var yaml = require("js-yaml");

var CASES = path.join(__dirname, "cases");
var SIZE = 12;
var BOX = { width: 300 };

/**
 * Every kind of scenario: the variations a file of that kind is drawn in,
 * and how one variation is drawn and which properties it must keep.
 */
var KINDS = {
  // One text() call in a text box.
  single: {
    variations: () =>
      product({
        direction: ["none", "auto", "rtl", "ltr"],
        charSpace: [0, 3],
        align: ["left", "right", "justify"],
      }),
    key: (v) => `${v.direction} cs${v.charSpace} ${v.align}`,
    title: (v) =>
      `${v.direction}, char space ${v.charSpace}, ${v.align === "justify" ? "justified" : `${v.align} aligned`}`,
    build(scenario, v) {
      // Justified text wraps in a narrow box so its first line is
      // justified; the others fit one line.
      var width = v.align === "justify" ? 60 : BOX.width;
      return {
        // A one-line right-aligned run ends at the box's right edge.
        rightEdge: v.align === "right" ? 50 + width : undefined,
        options: { size: SIZE, direction: v.direction, charSpace: v.charSpace },
        draw(recipe) {
          recipe.text(scenario.text, 50, 50, {
            font: "arial",
            size: SIZE,
            direction: v.direction,
            charSpace: v.charSpace,
            textBox: { width, textAlign: v.align },
          });
        },
      };
    },
  },

  // One text() call in a box only just wide enough for its text, which
  // must stay on one line.
  fit: {
    variations: () => product({ direction: ["auto", "rtl", "ltr"] }),
    key: (v) => v.direction,
    title: (v) => `${v.direction}, right aligned`,
    build(scenario, v) {
      return {
        oneLine: true,
        rightEdge: 50 + scenario.width,
        options: {
          size: SIZE,
          direction: v.direction,
          charSpace: scenario.charSpace,
        },
        draw(recipe) {
          recipe.text(scenario.text, 50, 50, {
            font: "arial",
            size: SIZE,
            direction: v.direction,
            charSpace: scenario.charSpace,
            textBox: { width: scenario.width, textAlign: "right" },
          });
        },
      };
    },
  },

  // A break ending a plain text, and ending a flow's run with something
  // following it.
  break: {
    variations: () => [
      ...product({ call: ["text"], direction: ["none", "auto"] }),
      ...product({
        call: ["flow"],
        after: Object.keys(AFTER_BREAK),
        direction: ["none", "auto"],
      }),
    ],
    key: (v) =>
      v.call === "text"
        ? `text ${v.direction}`
        : `flow ${v.after} ${v.direction}`,
    title: (v) =>
      v.call === "text"
        ? `ending a text, ${v.direction}`
        : `ending a flow run, then ${AFTER_BREAK[v.after].title}, ${v.direction}`,
    build(scenario, v) {
      if (v.call === "text") {
        return {
          draw(recipe) {
            recipe.text("\u05e9\u05dc\u05d5\u05dd" + scenario.break, 50, 50, {
              font: "arial",
              size: SIZE,
              direction: v.direction,
              textBox: { width: 200, textAlign: "right" },
            });
          },
        };
      }
      var after = AFTER_BREAK[v.after].text;
      return {
        // Text written after the flow must start below it.
        cursorBelow: true,
        draw(recipe) {
          var options = { font: "arial", size: SIZE, direction: v.direction };
          recipe
            .text("abc ", 50, 50, { ...options, flow: true, textBox: BOX })
            .text("\u05e9\u05dc\u05d5\u05dd" + scenario.break, options);
          if (after !== null) recipe.text(after, options);
          recipe.text("", { ...options, flow: false }).text("after", options);
        },
      };
    },
  },

  // A flow of plain, HTML and empty runs, ended in different ways.
  flow: {
    variations: () =>
      product({
        ending: ["end", "movedown"],
        direction: ["none", "auto"],
        align: ["left", "right"],
      }),
    key: (v) => `${v.ending} ${v.direction} ${v.align}`,
    title: (v) =>
      `${v.ending === "end" ? "ended" : "then movedown()"}, ${v.direction}, ${v.align} aligned`,
    build(scenario, v) {
      return {
        // A flow that ends without a break leaves the cursor on its line.
        cursorBelow: v.ending === "movedown",
        draw(recipe) {
          var options = { font: "arial", size: SIZE, direction: v.direction };
          scenario.runs.forEach(function ({ text, ...runOptions }, index) {
            var merged = { ...options, ...runOptions };
            if (index === 0) {
              recipe.text(text, 50, 50, {
                ...merged,
                flow: true,
                textBox: { width: 200, textAlign: v.align },
              });
            } else recipe.text(text, merged);
          });
          if (v.ending === "movedown") recipe.movedown();
          recipe.text("", { ...options, flow: false }).text("after", options);
        },
      };
    },
  },
};

// What may follow a break that ends a flow's run.
var AFTER_BREAK = {
  nothing: { text: null, title: "nothing" },
  space: { text: " ", title: "a space" },
  nbsp: { text: "\u00a0", title: "a no-break space" },
  "figure-space": { text: "\u2007", title: "a figure space" },
};

/**
 * Every combination of the values of some axes.
 *
 * @param {Object<string, Array>} axes The values of each axis.
 * @returns {object[]} The combinations, the first axis varying slowest.
 */
function product(axes) {
  return Object.entries(axes).reduce(
    (combinations, [axis, values]) =>
      combinations.flatMap((combination) =>
        values.map((value) => ({ ...combination, [axis]: value })),
      ),
    [{}],
  );
}

/**
 * The YAML files under a folder, sorted.
 *
 * @param {string} folder The folder.
 * @returns {string[]} Their paths.
 */
function scenarioFiles(folder) {
  return fs
    .readdirSync(folder, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      var file = path.join(folder, entry.name);
      if (entry.isDirectory()) return scenarioFiles(file);
      return entry.name.endsWith(".yml") ? [file] : [];
    });
}

var scenarios = scenarioFiles(CASES).map((file) => {
  var scenario = yaml.load(fs.readFileSync(file, "utf8"));
  var kind = KINDS[scenario.kind];
  if (!kind) throw new Error(`${file}: unknown kind ${scenario.kind}`);
  if (!scenario.description) throw new Error(`${file}: no description`);
  return { file, scenario, kind };
});

var cases = scenarios.flatMap(({ file, scenario, kind }) =>
  kind.variations().map((variation) => ({
    file,
    variation,
    key: kind.key(variation),
    title: `${scenario.description}: ${kind.title(variation)}`,
    ...kind.build(scenario, variation),
  })),
);

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
  if (testCase.oneLine) {
    var shown = summary.lines.filter((line) =>
      line.some(([text]) => text.trim() !== ""),
    );
    if (shown.length !== 1) broken.push(`drawn on ${shown.length} lines`);
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
 * Read the expected output of every variation of a file, with "same" for
 * Wasm resolved to the native output.
 *
 * @param {string} file The scenario file.
 * @returns {Object<string, {native?: object, wasm?: object,
 *   knownDifference?: string}>} The expected output by variation key.
 */
function readExpected(file) {
  var expected = yaml.load(fs.readFileSync(file, "utf8")).expected || {};
  Object.values(expected).forEach((entry) => {
    if (entry.wasm === "same") entry.wasm = entry.native;
  });
  return expected;
}

/**
 * The expected output of a case.
 *
 * @param {object} testCase The case.
 * @returns {{native?: object, wasm?: object, knownDifference?: string}} Its
 *   expected output on both ends, and why they may differ.
 */
function expectedOf(testCase) {
  if (!expectedByFile.has(testCase.file)) {
    expectedByFile.set(testCase.file, readExpected(testCase.file));
  }
  return expectedByFile.get(testCase.file)[testCase.key] || {};
}
var expectedByFile = new Map();

/**
 * Check a case's summary against its expected output on one end.
 *
 * @param {string} end "native" or "wasm".
 * @param {object} testCase The case.
 * @param {object} summary Its summary on that end.
 * @param {object} assert node:assert/strict.
 * @returns {void}
 */
function checkExpected(end, testCase, summary, assert) {
  var expected = expectedOf(testCase);
  assert.ok(
    expected[end],
    `missing from ${path.relative(CASES, testCase.file)}`,
  );
  assert.deepEqual(summary, expected[end]);
  if (!expected.native || !expected.wasm) return;
  var alike = isDeepStrictEqual(expected.native, expected.wasm);
  if (expected.knownDifference) {
    assert.ok(!alike, "the ends draw alike now: remove knownDifference");
  } else {
    assert.ok(alike, "native and Wasm differ");
  }
}

var { isDeepStrictEqual } = require("util");

/**
 * Write one end's output into the scenario files, keeping the other end's
 * output and each file's input as written.
 *
 * @param {string} end "native" or "wasm".
 * @param {Map<object, object>} summaries The end's summary of each case.
 * @returns {void}
 */
function writeExpected(end, summaries) {
  scenarios.forEach(({ file }) => {
    var expected = readExpected(file);
    var written = {};
    cases
      .filter((testCase) => testCase.file === file)
      .forEach((testCase) => {
        var entry = { ...expected[testCase.key] };
        if (summaries.has(testCase)) entry[end] = summaries.get(testCase);
        written[testCase.key] = entry;
      });
    var source = fs.readFileSync(file, "utf8");
    var input = source.replace(/^expected:[\s\S]*$/m, "").trimEnd();
    fs.writeFileSync(file, `${input}\n${expectedYaml(written)}`);
  });
}

/**
 * The expected: section of a scenario file. Strings are quoted, with marks,
 * formatting characters and spaces other than U+0020 written as escapes so
 * a review shows them.
 *
 * @param {Object<string, object>} expected The output by variation key.
 * @returns {string} The YAML.
 */
function expectedYaml(expected) {
  var out = ["expected:"];
  Object.entries(expected).forEach(([key, entry]) => {
    out.push(`  ${key}:`);
    ["native", "wasm"].forEach((end) => {
      var summary = entry[end];
      if (!summary) return;
      if (end === "wasm" && isDeepStrictEqual(summary, entry.native)) {
        out.push("    wasm: same");
        return;
      }
      out.push(`    ${end}:`);
      if (summary.lines.length) {
        out.push("      lines:");
        summary.lines.forEach((line) => out.push(`        - ${flow(line)}`));
      } else out.push("      lines: []");
      out.push(`      annotations: ${flow(summary.annotations)}`);
    });
    if (entry.knownDifference) {
      out.push(`    knownDifference: ${quote(entry.knownDifference)}`);
    }
  });
  return out.join("\n") + "\n";
}

/**
 * @param {*} value A summary value: an array, a string or a number.
 * @returns {string} It in YAML flow style.
 */
function flow(value) {
  if (Array.isArray(value)) return `[${value.map(flow).join(", ")}]`;
  return typeof value === "string" ? quote(value) : String(value);
}

/**
 * @param {string} text A string.
 * @returns {string} It double-quoted, with invisible characters escaped.
 */
function quote(text) {
  return JSON.stringify(text).replace(
    /[^\P{Z} ]|[\p{Cc}\p{Cf}\p{Mn}\p{Me}]/gu,
    (character) =>
      "\\u" + character.codePointAt(0).toString(16).padStart(4, "0"),
  );
}

module.exports = {
  cases,
  summarize,
  brokenProperties,
  checkExpected,
  writeExpected,
  quote,
  update: process.env.UPDATE_DIRECTION_MATRIX === "1",
};
