import { runValidation } from "./validation.mjs";
import { toVisual } from "../../lib/text-direction.js";

/**
 * Checks text in a worker, which has no import map unless the browser shares
 * the page's: text that is not reordered never needs bidi-js, and reordering
 * either works or names bidi-js.
 */
function rtlValidation() {
  var text = "\u05e9\u05dc\u05d5\u05dd abc";
  if (toVisual(text, "none") !== text) {
    throw new Error("text with direction none is drawn as given");
  }
  try {
    toVisual(text, "auto");
  } catch (error) {
    if (!String(error?.message).includes("needs bidi-js")) throw error;
  }
}

try {
  var result = await runValidation();
  rtlValidation();
  postMessage({ passed: true, ...result });
} catch (error) {
  postMessage({
    passed: false,
    error: error instanceof Error ? error.message : String(error),
  });
}
