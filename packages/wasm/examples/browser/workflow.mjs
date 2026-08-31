import {
  errorDetails,
  ObjectUrlStore,
  throwIfCancelled,
} from "./lifecycle.mjs";
import { runLowLevelExample } from "./low-level.mjs";
import { runRecipeExample } from "./recipe.mjs";
import { HOW_TO_EXAMPLES, runHowToExample } from "./how-tos.mjs";

export var BROWSER_EXAMPLES = [
  {
    id: "complete",
    label: "Complete lab",
    title: "Bring byte assets",
    description:
      "Run the original end-to-end low-level and Recipe workflow, with optional font and image assets.",
    assets: ["font", "jpeg", "png", "tiff"],
  },
  ...HOW_TO_EXAMPLES,
];

export async function runExampleWorkflow(options = {}) {
  var stage = "initialization";
  var progress = options.progress || (() => {});
  try {
    stage = "low-level";
    var lowLevel = await runLowLevelExample({ ...options, progress });
    throwIfCancelled(options.signal);
    stage = "recipe";
    var recipe = await runRecipeExample({
      ...options,
      source: lowLevel.source,
      progress,
    });
    progress("All PDFs parsed back successfully", 100);
    return {
      lowLevel: { bytes: lowLevel.bytes, summary: lowLevel.summary },
      recipe,
    };
  } catch (error) {
    error.exampleDetails = errorDetails(error, stage);
    error.message = `[${stage}] ${error.message}`;
    throw error;
  }
}

export async function runBrowserExample(options = {}) {
  if (!options.exampleId || options.exampleId === "complete")
    return runExampleWorkflow(options);
  try {
    return {
      example: await runHowToExample(options.exampleId, options),
    };
  } catch (error) {
    error.exampleDetails ||= errorDetails(error, options.exampleId);
    throw error;
  }
}

/** Verifies replacement and disposal without leaving a real object URL behind. */
export function validateObjectUrlLifecycle() {
  var created = [];
  var revoked = [];
  var urls = new ObjectUrlStore({
    createObjectURL() {
      var value = `blob:example-${created.length + 1}`;
      created.push(value);
      return value;
    },
    revokeObjectURL(value) {
      revoked.push(value);
    },
  });
  urls.replace(new Uint8Array([1]));
  urls.replace(new Uint8Array([2]));
  urls.dispose();
  return { created: created.length, revoked: revoked.length };
}
