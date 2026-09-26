import { errorDetails } from "./lifecycle.mjs";
import { runBrowserExample } from "./workflow.mjs";

/**
 * Runs the requested example and posts progress, the result, or the error.
 * @param {MessageEvent} event - `{ exampleId, assets }`.
 * @returns {Promise<void>} Resolves after the result or error is posted.
 */
self.onmessage = async (event) => {
  try {
    var result = await runBrowserExample({
      exampleId: event.data.exampleId,
      assets: event.data.assets,
      progress(message, percent, details) {
        postMessage({ type: "progress", message, percent, details });
      },
    });
    var transfer = result.example
      ? [result.example.bytes.buffer]
      : [result.lowLevel.bytes.buffer, result.recipe.bytes.buffer];
    postMessage({ type: "result", result }, transfer);
  } catch (error) {
    postMessage({
      type: "error",
      error: error.exampleDetails || errorDetails(error, "worker"),
    });
  }
};
