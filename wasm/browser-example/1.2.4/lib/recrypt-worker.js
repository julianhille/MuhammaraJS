// The worker side of recryptAsync(): loads its own Wasm instance and recrypts
// the PDFs the calling thread posts, one at a time.
import { createMuhammaraWasm } from "../index.js";

var workerThreads = globalThis.process?.getBuiltinModule?.(
  "node:worker_threads",
);
var port = workerThreads?.parentPort;
var settings = null;
var instance = null;
var queue = Promise.resolve();

/**
 * Sends a message to the calling thread.
 * @param {object} message - The message.
 * @param {Transferable[]} [transfer] - Buffers to move instead of copy.
 * @returns {void}
 */
function reply(message, transfer = []) {
  if (port) port.postMessage(message, transfer);
  else globalThis.postMessage(message, transfer);
}

/**
 * Loads this worker's Wasm instance, the same way the calling thread did. It
 * never starts a worker of its own.
 * @returns {Promise<object>} The Wasm API.
 */
function load() {
  if (!instance) {
    var options = { limits: settings.limits, recryptWorker: false };
    if (settings.wasmBinary !== undefined) {
      options.wasmBinary = settings.wasmBinary;
    } else if (settings.wasmLocation !== undefined) {
      /**
       * Loads the binary from where the calling thread loaded it.
       * @param {string} path - File Emscripten wants to load.
       * @param {string} prefix - Emscripten's script directory.
       * @returns {string} Its location.
       */
      options.locateFile = (path, prefix) =>
        path.endsWith(".wasm") ? settings.wasmLocation : prefix + path;
    }
    instance = createMuhammaraWasm(options);
    // A failed load is retried by the next job.
    instance.catch(() => {
      instance = null;
    });
  }
  return instance;
}

/**
 * Handles one message from the calling thread.
 * @param {object} message - `init` or `recrypt`.
 * @returns {Promise<void>}
 */
async function handle(message) {
  if (message.type === "init") {
    settings = message;
    try {
      await load();
      reply({ type: "ready" });
    } catch {
      reply({ type: "failed" });
    }
    return;
  }
  try {
    var muhammara = await load();
    var result = muhammara.recrypt(message.source, message.options);
    reply({ id: message.id, result }, [result.buffer]);
  } catch (error) {
    // An aborted instance cannot run another job; load a new one.
    if (error?.name === "RuntimeError") instance = null;
    reply({
      id: message.id,
      error: {
        name: error?.name || "Error",
        message: error?.message || String(error),
      },
    });
  }
}

/**
 * Queues a message, so jobs run in the order they were posted.
 * @param {object} message - The message.
 * @returns {void}
 */
function receive(message) {
  queue = queue.then(() => handle(message));
}

if (port) port.on("message", receive);
else globalThis.onmessage = (event) => receive(event.data);
