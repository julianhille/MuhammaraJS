import { createMuhammaraWasm } from "./module-options.mjs";
import { BENCHMARK_OPTIONS } from "./benchmark.mjs";

/**
 * Recrypts the posted PDF `runs` times, with `recryptAsync()` when `useAsync`
 * is set, and posts each duration, or the error.
 * @param {MessageEvent} event - `{ source, runs, useAsync }`.
 * @returns {Promise<void>} Resolves after the result or error is posted.
 */
self.onmessage = async (event) => {
  try {
    var muhammara = await createMuhammaraWasm();
    try {
      var durations = [];
      for (var index = 0; index < event.data.runs; index++) {
        var start = performance.now();
        if (event.data.useAsync)
          await muhammara.recryptAsync(event.data.source, BENCHMARK_OPTIONS);
        else muhammara.recrypt(event.data.source, BENCHMARK_OPTIONS);
        durations.push(performance.now() - start);
      }
      postMessage({ type: "result", durations });
    } finally {
      muhammara.disposeAssets();
    }
  } catch (error) {
    postMessage({ type: "error", message: error.message });
  }
};
