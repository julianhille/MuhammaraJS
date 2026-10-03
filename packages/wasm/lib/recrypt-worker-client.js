// Runs recryptAsync() jobs in a worker, so the calling thread stays free while
// a PDF is recrypted, as native runs them on a libuv pool thread.

/**
 * Reads the Node `worker_threads` module without an import a browser bundler
 * would try to resolve.
 * @returns {object|undefined} The module, or undefined outside Node.
 */
function nodeWorkerThreads() {
  var getBuiltinModule = globalThis.process?.getBuiltinModule;
  if (typeof getBuiltinModule !== "function") return undefined;
  try {
    return getBuiltinModule("node:worker_threads");
  } catch {
    return undefined;
  }
}

/**
 * Tells whether this code already runs off the main thread, where a second
 * worker would only add its startup time.
 * @param {object|undefined} workerThreads - Node `worker_threads`, if any.
 * @returns {boolean} Whether the caller is itself a worker.
 */
function insideWorker(workerThreads) {
  if (workerThreads) return !workerThreads.isMainThread;
  return (
    typeof WorkerGlobalScope === "function" &&
    globalThis instanceof WorkerGlobalScope
  );
}

/**
 * Wraps a module Worker in the handle the host uses.
 * @param {Worker} worker - The started Worker.
 * @returns {object} The worker handle.
 */
function browserHandle(worker) {
  return {
    /**
     * Posts a message, moving `transfer` instead of copying it.
     * @param {object} message - The message.
     * @param {Transferable[]} transfer - Buffers to move.
     * @returns {void}
     */
    post(message, transfer) {
      worker.postMessage(message, transfer);
    },
    /**
     * Calls `handler` with each message the worker sends.
     * @param {function(object): void} handler - Receives the message data.
     * @returns {void}
     */
    onMessage(handler) {
      worker.onmessage = (event) => handler(event.data);
    },
    /**
     * Calls `handler` when the worker fails to load or run.
     * @param {function(Error): void} handler - Receives why it failed.
     * @returns {void}
     */
    onFailure(handler) {
      worker.onerror = (event) => {
        event.preventDefault?.();
        handler(new Error(event.message || "recryptAsync worker failed"));
      };
      worker.onmessageerror = () =>
        handler(new Error("recryptAsync worker sent an unreadable message"));
    },
    /**
     * Does nothing: a browser Worker never keeps a page alive.
     * @returns {void}
     */
    ref() {},
    /**
     * Does nothing: a browser Worker never keeps a page alive.
     * @returns {void}
     */
    unref() {},
    /**
     * Stops the worker.
     * @returns {void}
     */
    terminate() {
      worker.terminate();
    },
  };
}

/**
 * Wraps a Node `worker_threads` worker in the handle the host uses.
 * @param {object} thread - The started `worker_threads` Worker.
 * @returns {object} The worker handle.
 */
function nodeHandle(thread) {
  return {
    /**
     * Posts a message, moving `transfer` instead of copying it.
     * @param {object} message - The message.
     * @param {Transferable[]} transfer - Buffers to move.
     * @returns {void}
     */
    post(message, transfer) {
      thread.postMessage(message, transfer);
    },
    /**
     * Calls `handler` with each message the worker sends.
     * @param {function(object): void} handler - Receives the message.
     * @returns {void}
     */
    onMessage(handler) {
      thread.on("message", handler);
    },
    /**
     * Calls `handler` when the worker throws or stops.
     * @param {function(Error): void} handler - Receives why it failed.
     * @returns {void}
     */
    onFailure(handler) {
      thread.on("error", handler);
      thread.on("exit", () =>
        handler(new Error("recryptAsync worker stopped")),
      );
    },
    /**
     * Keeps the process alive while a job runs.
     * @returns {void}
     */
    ref() {
      thread.ref();
    },
    /**
     * Lets the process exit while the worker is idle.
     * @returns {void}
     */
    unref() {
      thread.unref();
    },
    /**
     * Stops the worker.
     * @returns {void}
     */
    terminate() {
      thread.terminate();
    },
  };
}

/**
 * Starts the worker for this environment: a module Worker in browsers, Deno,
 * and Bun, `worker_threads` in Node.
 * @param {object|undefined} workerThreads - Node `worker_threads`, if any.
 * @returns {object|null} The worker handle, or null without worker support.
 * @throws {Error} If the environment refuses to create the worker.
 */
function startWorker(workerThreads) {
  if (typeof Worker === "function") {
    // Bundlers find the worker script only in this exact form.
    return browserHandle(
      new Worker(new URL("./recrypt-worker.js", import.meta.url), {
        type: "module",
      }),
    );
  }
  if (workerThreads) {
    return nodeHandle(
      new workerThreads.Worker(new URL("./recrypt-worker.js", import.meta.url)),
    );
  }
  return null;
}

/**
 * Recreates an error the worker reported, keeping its type and message.
 * @param {{name: string, message: string}} reported - The worker's error.
 * @returns {Error} The error to reject with.
 */
function reportedError(reported) {
  var types = { TypeError, RangeError };
  var error = new (types[reported.name] || Error)(reported.message);
  if (!types[reported.name] && reported.name !== "Error") {
    error.name = reported.name;
  }
  return error;
}

/**
 * Creates the recryptAsync() worker host for one Wasm instance. The worker
 * starts on the first job and is reused; under Node it keeps the process
 * alive only while a job runs.
 * @param {object} settings - What the worker needs to load the same module.
 * @param {Uint8Array|ArrayBuffer} [settings.wasmBinary] - The caller's binary.
 * @param {string} [settings.wasmLocation] - Where the caller's `locateFile`
 *   loaded the binary from.
 * @param {number} settings.maxInputBytes - Input limit of the instance.
 * @param {number} settings.maxOutputBytes - Output limit of the instance.
 * @returns {{run: function(Uint8Array, object): Promise<Uint8Array|null>}}
 *   `run` resolves with null when no worker can run the job, so the caller
 *   recrypts on its own thread.
 */
export function createRecryptWorkerHost(settings) {
  var workerThreads = nodeWorkerThreads();
  var available =
    (typeof Worker === "function" || workerThreads !== undefined) &&
    !insideWorker(workerThreads);
  var ready = null;
  var nextId = 0;
  var jobs = new Map();

  /**
   * Rejects every running job and forgets the worker, so the next job starts
   * a new one.
   * @param {object} handle - The failed worker.
   * @param {Error} error - Why it failed.
   * @returns {void}
   */
  function fail(handle, error) {
    if (handle.failed) return;
    handle.failed = true;
    ready = null;
    try {
      handle.terminate();
    } catch {
      // Already gone.
    }
    for (var job of jobs.values()) job.reject(error);
    jobs.clear();
  }

  /**
   * Starts the worker and waits until its module has loaded.
   * @returns {Promise<object|null>} The worker, or null when it cannot start.
   */
  function start() {
    var handle;
    try {
      handle = startWorker(workerThreads);
    } catch {
      return Promise.resolve(null);
    }
    if (!handle) return Promise.resolve(null);
    return new Promise((resolve) => {
      var loaded = false;
      handle.onFailure((error) => {
        if (!loaded) {
          loaded = true;
          handle.failed = true;
          try {
            handle.terminate();
          } catch {
            // Already gone.
          }
          resolve(null);
          return;
        }
        fail(handle, error);
      });
      handle.onMessage((message) => {
        if (message.type === "ready" || message.type === "failed") {
          if (loaded) return;
          loaded = true;
          if (message.type === "failed") {
            handle.failed = true;
            handle.terminate();
            resolve(null);
            return;
          }
          handle.unref();
          resolve(handle);
          return;
        }
        var job = jobs.get(message.id);
        if (!job) return;
        jobs.delete(message.id);
        if (jobs.size === 0) handle.unref();
        if (message.error) job.reject(reportedError(message.error));
        else job.resolve(message.result);
      });
      handle.post({
        type: "init",
        wasmBinary: settings.wasmBinary,
        wasmLocation: settings.wasmLocation,
        limits: {
          maxInputBytes: settings.maxInputBytes,
          maxOutputBytes: settings.maxOutputBytes,
        },
      });
    });
  }

  return {
    /**
     * Recrypts in the worker.
     * @param {Uint8Array} source - PDF bytes owned by this call; their buffer
     *   is transferred to the worker when it holds nothing else.
     * @param {object} options - Recrypt options with plain values only.
     * @returns {Promise<Uint8Array|null>} The rewritten PDF, or null when no
     *   worker can run it.
     */
    async run(source, options) {
      if (!available) return null;
      if (!ready) {
        ready = start();
        // A worker that cannot start never will: stop trying.
        ready.then((handle) => {
          if (!handle) available = false;
        });
      }
      var handle = await ready;
      if (!handle) return null;
      return new Promise((resolve, reject) => {
        var id = nextId++;
        jobs.set(id, { resolve, reject });
        handle.ref();
        var whole =
          source.byteOffset === 0 &&
          source.byteLength === source.buffer.byteLength;
        try {
          handle.post(
            { type: "recrypt", id, source, options },
            whole ? [source.buffer] : [],
          );
        } catch (error) {
          jobs.delete(id);
          if (jobs.size === 0) handle.unref();
          reject(error);
        }
      });
    },
  };
}
