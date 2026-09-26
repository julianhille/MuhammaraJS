import { errorDetails, ObjectUrlStore } from "./lifecycle.mjs";
import { BROWSER_EXAMPLES, runBrowserExample } from "./workflow.mjs";

var form = document.querySelector("#example-form");
var runButton = document.querySelector("#run");
var cancelButton = document.querySelector("#cancel");
var status = document.querySelector("#status");
var progressBar = document.querySelector("#progress");
var output = document.querySelector("#output");
var preview = document.querySelector("#preview");
var download = document.querySelector("#download");
var outputChoice = document.querySelector("#output-choice");
var outputChoiceLabel = document.querySelector("#output-choice-label");
var tabs = Array.from(document.querySelectorAll('[role="tab"]'));
var title = document.querySelector("#controls-title");
var description = document.querySelector("#example-description");
var requirement = document.querySelector("#example-requirement");
var fileGrid = document.querySelector(".file-grid");
var assetFields = Array.from(document.querySelectorAll("[data-asset]"));
var versionPicker = document.querySelector("#version-picker");
var versionSelect = document.querySelector("#version");
var urls = new ObjectUrlStore();
var active;
var result;
var exampleId = "complete";
var examples = new Map(
  BROWSER_EXAMPLES.map((example) => [example.id, example]),
);

/** Opens the selected deployed browser example version. */
function selectVersion() {
  window.location.href = new URL(
    `../${encodeURIComponent(versionSelect.value)}/index.html`,
    window.location.href,
  ).href;
}

/** Loads the versions managed by Mike when the example runs on GitHub Pages. */
async function setupVersionPicker() {
  try {
    var response = await fetch("../versions.json");
    if (!response.ok) return;
    var versions = await response.json();
    var current = new URL(".", window.location.href).pathname
      .split("/")
      .filter(Boolean)
      .pop();
    for (var entry of versions) {
      var option = document.createElement("option");
      option.value = entry.version;
      option.textContent = entry.title;
      option.selected =
        entry.version === current || entry.aliases.includes(current);
      versionSelect.append(option);
    }
    versionSelect.addEventListener("change", selectVersion);
    versionPicker.hidden = false;
  } catch {
    // Local examples do not have Mike's versions manifest.
  }
}

void setupVersionPicker();

/**
 * Shows progress, and summary details when given.
 * @param {string} message - Status text.
 * @param {number} [percent=0] - Progress from 0 to 100.
 * @param {object} [details] - Summary to print as JSON.
 * @returns {void}
 */
function report(message, percent = 0, details) {
  progressBar.value = percent;
  status.textContent = message;
  if (details) output.textContent = JSON.stringify(details, null, 2);
}

/**
 * Reads the file chosen in a form input.
 * @param {string} name - Input name.
 * @returns {Promise<Uint8Array<ArrayBuffer>|undefined>} The bytes, or undefined when no file is chosen.
 */
async function fileBytes(name) {
  var file = form.elements[name].files[0];
  return file ? new Uint8Array(await file.arrayBuffer()) : undefined;
}

/**
 * Reads every optional asset input.
 * @returns {Promise<import("./lifecycle.mjs").ExampleAssets>} The chosen assets.
 */
async function assets() {
  return {
    font: await fileBytes("font"),
    jpeg: await fileBytes("jpeg"),
    png: await fileBytes("png"),
    tiff: await fileBytes("tiff"),
  };
}

/**
 * Builds the summary shown after a run.
 * @param {object} value - Result of `runBrowserExample()`.
 * @returns {object} Display values and output sizes.
 */
function summary(value) {
  if (value.example)
    return {
      example: examples.get(exampleId).title,
      outputBytes: value.example.bytes.length,
      ...value.example.summary,
    };
  return {
    mode: form.elements.mode.value,
    lowLevel: value.lowLevel.summary,
    recipe: value.recipe.summary,
    outputBytes: {
      lowLevel: value.lowLevel.bytes.length,
      recipe: value.recipe.bytes.length,
    },
  };
}

/**
 * Previews the selected output PDF and offers it for download.
 * @returns {void}
 */
function showResult() {
  if (!result) return;
  var selected = result.example
    ? result.example
    : outputChoice.value === "recipe"
      ? result.recipe
      : result.lowLevel;
  var name = result.example
    ? selected.filename
    : outputChoice.value === "recipe"
      ? "muhammara-recipe.pdf"
      : "muhammara-low-level.pdf";
  var url = urls.replace(selected.bytes);
  preview.src = url;
  download.href = url;
  download.download = name;
  download.textContent = `Download ${name} (${selected.bytes.length.toLocaleString()} bytes)`;
  download.hidden = false;
}

/**
 * Runs an example in a module Worker.
 * @param {import("./lifecycle.mjs").ExampleAssets} byteAssets - Assets to transfer.
 * @param {string} selectedExample - Example id.
 * @returns {Promise<object>} The example result.
 * @throws {DOMException} If the run is cancelled.
 * @throws {Error} If the Worker reports an error.
 */
function runInWorker(byteAssets, selectedExample) {
  return new Promise((resolve, reject) => {
    var worker = new Worker("./example-worker.mjs", { type: "module" });
    /**
     * Ends the Worker and settles the promise.
     * @param {function(*): void} callback - `resolve` or `reject`.
     * @param {*} value - Result or error.
     * @returns {void}
     */
    var finish = (callback, value) => {
      worker.terminate();
      callback(value);
    };
    active = {
      /**
       * Cancels the Worker run.
       * @returns {void}
       */
      cancel: () =>
        finish(
          reject,
          new DOMException("Worker operation cancelled", "AbortError"),
        ),
    };
    /**
     * Handles progress, result, and error messages from the Worker.
     * @param {MessageEvent} event - Worker message.
     * @returns {void}
     */
    worker.onmessage = (event) => {
      if (event.data.type === "progress") {
        report(event.data.message, event.data.percent, event.data.details);
      } else if (event.data.type === "result") {
        finish(resolve, event.data.result);
      } else if (event.data.type === "error") {
        var error = new Error(event.data.error.message);
        error.exampleDetails = event.data.error;
        finish(reject, error);
      }
    };
    /**
     * Rejects the run when the Worker fails to load or throws.
     * @param {ErrorEvent} event - Worker error.
     * @returns {void}
     */
    worker.onerror = (event) => {
      finish(reject, new Error(event.message));
    };
    worker.postMessage({ exampleId: selectedExample, assets: byteAssets });
  });
}

/**
 * Activates an example tab unless a run is active.
 * @param {string} selectedId - Example id.
 * @param {boolean} [focus=false] - Move keyboard focus to the tab.
 * @returns {void}
 */
function selectExample(selectedId, focus = false) {
  var selected = examples.get(selectedId);
  if (!selected || active) return;
  exampleId = selectedId;
  tabs.forEach((tab) => {
    var current = tab.dataset.example === selectedId;
    tab.setAttribute("aria-selected", String(current));
    tab.tabIndex = current ? 0 : -1;
    if (current && focus) tab.focus();
  });
  title.textContent = selected.title;
  description.textContent = selected.description;
  requirement.textContent = selected.requirement || "";
  requirement.hidden = !selected.requirement;
  assetFields.forEach((field) => {
    field.hidden = !selected.assets.includes(field.dataset.asset);
  });
  fileGrid.hidden = selected.assets.length === 0;
  runButton.textContent =
    selectedId === "complete"
      ? "Run complete workflow"
      : `Run ${selected.label}`;
  outputChoiceLabel.hidden = selectedId !== "complete";
  download.hidden = true;
  urls.revoke();
  result = undefined;
  report(`Ready to run: ${selected.title}.`);
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectExample(tab.dataset.example));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    var target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
            tabs.length;
    selectExample(tabs[target].dataset.example, true);
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  var selectedExample = exampleId;
  runButton.disabled = true;
  tabs.forEach((tab) => (tab.disabled = true));
  cancelButton.disabled = false;
  download.hidden = true;
  urls.revoke();
  result = undefined;
  try {
    var byteAssets = await assets();
    if (form.elements.mode.value === "worker")
      result = await runInWorker(byteAssets, selectedExample);
    else {
      var controller = new AbortController();
      active = {
        /**
         * Cancels the in-page run.
         * @returns {void}
         */
        cancel: () => controller.abort(),
      };
      result = await runBrowserExample({
        exampleId: selectedExample,
        assets: byteAssets,
        signal: controller.signal,
        progress: report,
      });
    }
    output.textContent = JSON.stringify(summary(result), null, 2);
    report("Complete. The PDF was parsed back successfully.", 100);
    showResult();
  } catch (error) {
    var details = error.exampleDetails || errorDetails(error, "application");
    report(`${details.name}: ${details.message}`, 0, details);
  } finally {
    active = undefined;
    runButton.disabled = false;
    tabs.forEach((tab) => (tab.disabled = false));
    cancelButton.disabled = true;
  }
});

cancelButton.addEventListener("click", () => {
  active?.cancel();
  active = undefined;
  report(
    "Cancelled. A Worker run was terminated; a page run stops at its next stage boundary.",
  );
  runButton.disabled = false;
  tabs.forEach((tab) => (tab.disabled = false));
  cancelButton.disabled = true;
});

outputChoice.addEventListener("change", showResult);
window.addEventListener("pagehide", () => {
  active?.cancel();
  urls.dispose();
});
