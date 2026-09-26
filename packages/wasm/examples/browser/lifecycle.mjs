/**
 * Reports example progress to the page or Worker.
 * @callback ProgressCallback
 * @param {string} message - What the example is doing.
 * @param {number} percent - Progress from 0 to 100.
 * @param {object} [details] - Summary data to show.
 * @returns {void}
 */

/**
 * Optional byte assets chosen in the page.
 * @typedef {object} ExampleAssets
 * @property {Uint8Array} [font] - TrueType or OpenType font bytes.
 * @property {Uint8Array} [jpeg] - JPEG bytes.
 * @property {Uint8Array} [png] - PNG bytes.
 * @property {Uint8Array} [tiff] - TIFF bytes.
 */

/**
 * A generated example PDF and its parsed-back summary.
 * @typedef {object} ExampleResult
 * @property {string} [filename] - Suggested download name.
 * @property {Uint8Array} bytes - The PDF bytes.
 * @property {object} summary - Values read back from the PDF.
 */

/**
 * Options shared by the example runners.
 * @typedef {object} ExampleOptions
 * @property {string} [exampleId] - How-to id, or `complete` for the full workflow.
 * @property {ExampleAssets} [assets] - Optional byte assets.
 * @property {AbortSignal} [signal] - Cancels the example between steps.
 * @property {ProgressCallback} [progress] - Receives progress updates.
 */

/**
 * Stops an example that was cancelled.
 * @param {AbortSignal} [signal] - Cancellation signal.
 * @returns {void}
 * @throws {DOMException} An `AbortError` if the signal is aborted.
 */
export function throwIfCancelled(signal) {
  if (signal?.aborted)
    throw new DOMException("Operation cancelled", "AbortError");
}

/**
 * Describes an error for display or Worker transfer.
 * @param {*} error - Thrown value.
 * @param {string} stage - Example stage that failed.
 * @returns {{name: string, message: string, stage: string, stack: (string|undefined)}} Serializable details.
 */
export function errorDetails(error, stage) {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
    stage,
    stack: error instanceof Error ? error.stack : undefined,
  };
}

export class ObjectUrlStore {
  constructor(urlApi = URL) {
    this.urlApi = urlApi;
    this.current = undefined;
  }

  replace(bytes, type = "application/pdf") {
    this.revoke();
    this.current = this.urlApi.createObjectURL(new Blob([bytes], { type }));
    return this.current;
  }

  revoke() {
    if (!this.current) return false;
    this.urlApi.revokeObjectURL(this.current);
    this.current = undefined;
    return true;
  }

  dispose() {
    this.revoke();
  }
}

export function endQuietly(owner) {
  try {
    owner?.end?.();
  } catch {
    owner?.dispose?.();
  }
}
