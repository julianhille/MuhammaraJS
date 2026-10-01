import { createMuhammaraWasm, createRecipe } from "./module-options.mjs";
import { throwIfCancelled } from "./lifecycle.mjs";

// Options every benchmark run encrypts with.
export var BENCHMARK_OPTIONS = {
  userPassword: "view",
  ownerPassword: "edit",
  userProtectionFlag: 4,
};

// How often the page checks that it still responds while a recrypt runs.
var SAMPLE_INTERVAL_MS = 10;
// Frames longer than this count as visibly dropped.
var FRAME_BUDGET_MS = 1000 / 60;

/**
 * Builds the default benchmark input: uncompressed pages of vector content,
 * large enough that a recrypt takes long enough to see the page stall.
 * @param {number} [pages=120] - Page count.
 * @returns {Promise<Uint8Array>} The PDF.
 */
export async function createBenchmarkSource(pages = 120) {
  var muhammara = await createMuhammaraWasm();
  try {
    var writer = muhammara.createWriter({ compress: false });
    for (var index = 0; index < pages; index++) {
      var page = writer.createPage(0, 0, 595, 842);
      var context = writer.startPageContentContext(page);
      for (var row = 0; row < 120; row++) {
        for (var column = 0; column < 4; column++) {
          context
            .q()
            .rg(((row + index) % 10) / 10, column / 4, 0.6)
            .re(40 + column * 130, 40 + row * 6, 120, 4)
            .f()
            .Q();
        }
      }
      writer.writePage(page);
    }
    return writer.end();
  } finally {
    muhammara.disposeAssets();
  }
}

/**
 * Samples how late a short timer fires, and the gaps between animation
 * frames when the environment has them, until stopped.
 * @returns {{stop: function(): {lags: number[], frames: number[]}}} The sampler.
 */
function startSampler() {
  var lags = [];
  var frames = [];
  var expected = performance.now() + SAMPLE_INTERVAL_MS;
  var timer;
  var frame;
  var lastFrame;
  var tick = () => {
    var now = performance.now();
    lags.push(Math.max(0, now - expected));
    expected = now + SAMPLE_INTERVAL_MS;
    timer = setTimeout(tick, SAMPLE_INTERVAL_MS);
  };
  timer = setTimeout(tick, SAMPLE_INTERVAL_MS);
  if (typeof requestAnimationFrame === "function") {
    var onFrame = (time) => {
      if (lastFrame !== undefined) frames.push(time - lastFrame);
      lastFrame = time;
      frame = requestAnimationFrame(onFrame);
    };
    frame = requestAnimationFrame(onFrame);
  }
  return {
    stop() {
      clearTimeout(timer);
      if (frame !== undefined) cancelAnimationFrame(frame);
      // A stall still running when the work ends has not fired the timer yet.
      lags.push(Math.max(0, performance.now() - expected));
      return { lags, frames };
    },
  };
}

/**
 * Waits for the event loop, so timers and frames can run between recrypts.
 * @returns {Promise<void>} Resolves on the next macrotask.
 */
function yieldToEventLoop() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * @param {number[]} values - Samples.
 * @returns {number} The median, or 0 without samples.
 */
function median(values) {
  if (values.length === 0) return 0;
  var sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Rounds to one decimal place for display.
 * @param {number} value - Milliseconds.
 * @returns {number} The rounded value.
 */
function round(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Measures one way of running recrypt while the page samples itself.
 * @param {string} label - Mode name for the report.
 * @param {function(): Promise<number[]>} run - Runs every recrypt and
 *   resolves with each one's duration in milliseconds.
 * @param {number} runs - Recrypt count.
 * @returns {Promise<object>} The mode's results.
 */
async function measure(label, run, runs) {
  var sampler = startSampler();
  var start = performance.now();
  var durations = await run();
  var wallMs = performance.now() - start;
  var { lags, frames } = sampler.stop();
  return {
    mode: label,
    runs,
    wallMs: round(wallMs),
    recryptMedianMs: round(median(durations)),
    // Time the page could not run timers: each sample's lateness.
    blockedMs: round(lags.reduce((sum, lag) => sum + lag, 0)),
    longestStallMs: round(Math.max(0, ...lags)),
    timerTicks: lags.length - 1,
    longestFrameMs: frames.length ? round(Math.max(...frames)) : null,
    droppedFrames: frames.reduce(
      (sum, gap) => sum + Math.max(0, Math.round(gap / FRAME_BUDGET_MS) - 1),
      0,
    ),
  };
}

/**
 * Runs recrypt on the current thread, one call per macrotask.
 * @param {object} muhammara - Loaded Wasm API.
 * @param {Uint8Array} source - PDF to encrypt.
 * @param {number} runs - Recrypt count.
 * @param {boolean} useAsync - Call `recryptAsync()` instead of `recrypt()`.
 * @returns {Promise<number[]>} Each recrypt's duration in milliseconds.
 */
async function recryptOnThisThread(muhammara, source, runs, useAsync) {
  var durations = [];
  for (var index = 0; index < runs; index++) {
    await yieldToEventLoop();
    var start = performance.now();
    if (useAsync) await muhammara.recryptAsync(source, BENCHMARK_OPTIONS);
    else muhammara.recrypt(source, BENCHMARK_OPTIONS);
    durations.push(performance.now() - start);
  }
  return durations;
}

/**
 * Renders the results into a one-page PDF report.
 * @param {object[]} results - One entry per mode.
 * @param {object} input - Source description.
 * @returns {Promise<Uint8Array>} The report PDF.
 */
async function renderReport(results, input) {
  var Recipe = await createRecipe();
  var recipe = new Recipe({ compress: false });
  try {
    recipe
      .createPage(595, 842)
      .text("Recrypt benchmark", 50, 60, { fontSize: 24, color: "#1e3a8a" })
      .text(
        `${input.label}, ${(input.bytes / 1024 / 1024).toFixed(1)} MB, ${results[0].runs} recrypts per mode`,
        50,
        100,
        { fontSize: 11, color: "#334155" },
      )
      .table(
        50,
        140,
        results.map((result) => ({
          mode: result.mode,
          recrypt: `${result.recryptMedianMs} ms`,
          blocked: `${result.blockedMs} ms`,
          stall: `${result.longestStallMs} ms`,
          ticks: String(result.timerTicks),
        })),
        {
          fontSize: 10,
          header: true,
          border: { width: 1, color: "#1d4ed8" },
          columns: [
            { name: "mode", width: 170, cell: { padding: 7 } },
            { name: "recrypt", width: 80, cell: { padding: 7 } },
            { name: "blocked", width: 85, cell: { padding: 7 } },
            { name: "stall", width: 80, cell: { padding: 7 } },
            { name: "ticks", width: 80, cell: { padding: 7 } },
          ],
        },
      )
      .text(
        "recrypt is the median time per recrypt. blocked is the time the page could not run a 10 ms timer, stall the longest such pause, and ticks how often the timer ran.",
        50,
        330,
        { fontSize: 9, color: "#475569", textBox: { width: 495 } },
      )
      .endPage();
    return recipe.endPDF();
  } finally {
    recipe.dispose();
    Recipe.disposeAssets();
  }
}

/**
 * Benchmarks synchronous recrypt() and promise-based recryptAsync() on this
 * thread and, when the page provides `runInWorker`, both in a module Worker,
 * while the page samples how long it stops responding.
 * @param {import("./lifecycle.mjs").ExampleAssets} assets - Optional `pdf`
 *   input and `runs` count.
 * @param {object} [options={}] - `runInWorker(source, runs, useAsync)`
 *   resolving with each recrypt's duration, and a cancellation `signal`.
 * @returns {Promise<import("./lifecycle.mjs").ExampleResult>} The report PDF
 *   and the measurements.
 */
export async function benchmarkExample(assets, options = {}) {
  var runs = Math.min(50, Math.max(1, Number(assets.runs) || 5));
  var source = assets.pdf || (await createBenchmarkSource());
  var input = {
    label: assets.pdf ? "Uploaded PDF" : "Generated 120-page PDF",
    bytes: source.length,
  };
  var muhammara = await createMuhammaraWasm();
  try {
    var modes = [
      [
        "sync recrypt() on the page",
        () => recryptOnThisThread(muhammara, source, runs, false),
      ],
      [
        "recryptAsync() on the page",
        () => recryptOnThisThread(muhammara, source, runs, true),
      ],
    ];
    if (options.runInWorker) {
      modes.push(
        [
          "sync recrypt() in a Worker",
          () => options.runInWorker(source, runs, false),
        ],
        [
          "recryptAsync() in a Worker",
          () => options.runInWorker(source, runs, true),
        ],
      );
    }
    var results = [];
    for (var [label, run] of modes) {
      throwIfCancelled(options.signal);
      results.push(await measure(label, run, runs));
    }
    throwIfCancelled(options.signal);
    return {
      bytes: await renderReport(results, input),
      filename: "muhammara-recrypt-benchmark.pdf",
      summary: { pages: 1, input, results },
    };
  } finally {
    muhammara.disposeAssets();
  }
}
