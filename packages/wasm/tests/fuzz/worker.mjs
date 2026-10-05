// Runs fuzz inputs against one Wasm instance per thread. A trapped or aborted
// instance cannot be trusted afterwards, so the worker reports the finding and
// exits; the runner starts a fresh one.
//
// Besides crashes, each input is measured: its run time, how far it grew Wasm
// memory, and, in an AddressSanitizer build, how many heap bytes it left
// allocated after every object it created was ended or disposed.
import { parentPort, workerData } from "node:worker_threads";
import { createMuhammaraWasm, createRecipe } from "../../index.js";
import {
  classifyError,
  observations,
  profile,
  signature,
  targets,
} from "./targets.mjs";

var modules = [];
var errorOutput = [];

/**
 * Module options for one instance. `onRuntimeInitialized` runs with the
 * Emscripten module as `this`, which the public API does not expose.
 * @returns {object} Options.
 */
function moduleOptions() {
  return {
    limits: { maxInputBytes: 64 << 20, maxOutputBytes: 64 << 20 },
    recryptWorker: false,
    // Read by AddressSanitizer builds only. A small quarantine keeps a
    // long-lived instance inside its memory limit. Leaks are checked on
    // demand by the leak confirmation below; the instance never exits.
    ASAN_OPTIONS: "quarantine_size_mb=32:detect_leaks=1:malloc_context_size=16",
    /**
     * Records the initialized Emscripten module, passed as `this`.
     */
    onRuntimeInitialized() {
      modules.push(this);
    },
    /**
     * Keeps and prints the module's stderr. Sanitizer reports are printed
     * synchronously, so a leak check can read the report its own call
     * produced.
     * @param {string} text - One line of stderr output.
     */
    printErr(text) {
      errorOutput.push(text);
      console.error(text);
    },
  };
}

var context = {
  muhammara: await createMuhammaraWasm(moduleOptions()),
  Recipe: workerData.recipe ? await createRecipe(moduleOptions()) : undefined,
};
profile.memory = memoryBytes;
var sanitized = modules.every(
  (module) => typeof module._muhammara_fuzz_allocated_bytes === "function",
);

/**
 * Heap bytes currently allocated in every instance.
 * @returns {number|null} The bytes, or null without AddressSanitizer.
 */
function allocatedBytes() {
  if (!sanitized) return null;
  return modules.reduce(
    (sum, module) => sum + module._muhammara_fuzz_allocated_bytes(),
    0,
  );
}

/**
 * Size of every instance's linear memory, which never shrinks.
 * @returns {number} The bytes.
 */
function memoryBytes() {
  return modules.reduce(
    (sum, module) => sum + module.HEAPU8.buffer.byteLength,
    0,
  );
}

/**
 * Runs a LeakSanitizer check in every instance and collects the leak records
 * it printed, keyed by allocation stack without addresses.
 * @returns {Map<string, string>} Stack signature to report text.
 */
function leakRecords() {
  var records = new Map();
  for (var module of modules) {
    errorOutput.length = 0;
    module._muhammara_fuzz_leak_check();
    var text = errorOutput.join("\n");
    for (var block of text.split(/\n(?=(?:Direct|Indirect) leak of )/)) {
      block = block.slice(block.search(/(?:Direct|Indirect) leak of /));
      if (!/^(?:Direct|Indirect) leak of /.test(block)) continue;
      var frames = block
        .split("\n")
        .filter((line) => /^\s+#\d+ /.test(line))
        .map((line) =>
          line
            .replace(/0x[0-9a-f]+/gi, "")
            .replace(/\s+/g, " ")
            .trim(),
        );
      records.set(frames.join("\n"), block.split("\n\n")[0].trim());
    }
  }
  return records;
}

/**
 * Runs one input. A finding is reported and ends the worker.
 * @param {number} id - Message id.
 * @param {string} target - Target name.
 * @param {Uint8Array} bytes - Input.
 */
function runOnce(id, target, bytes) {
  try {
    targets[target].run(context, bytes);
  } catch (error) {
    var kind = classifyError(error);
    if (kind) {
      parentPort.postMessage({
        id,
        status: "finding",
        kind,
        message: String(error?.message ?? error),
        stack: String(error?.stack ?? ""),
      });
      process.exit(0);
    }
    observations.add(signature(error));
  }
}

parentPort.on("message", ({ id, target, bytes, repeat }) => {
  if (repeat) {
    // Leak confirmation: run the input again and again. Caches the first run
    // filled stay as they are, so growth on every repeat is a leak.
    var baseline = sanitized ? leakRecords() : new Map();
    var deltas = [];
    for (var i = 0; i < repeat; ++i) {
      var before = allocatedBytes();
      runOnce(id, target, bytes);
      deltas.push(allocatedBytes() - before);
    }
    var report = [];
    if (sanitized) {
      for (var [key, block] of leakRecords()) {
        if (!baseline.has(key)) report.push(block);
      }
    }
    // Direct leaks first, largest first: an indirect leak is only held by one.
    /**
     * Reads the byte count of a leak record.
     * @param {string} block - Leak record text.
     * @returns {number} The leaked bytes, or 0 when not stated.
     */
    var bytesOf = (block) => Number(/leak of (\d+)/.exec(block)?.[1] ?? 0);
    report.sort(
      (a, b) =>
        Number(b.startsWith("Direct")) - Number(a.startsWith("Direct")) ||
        bytesOf(b) - bytesOf(a),
    );
    parentPort.postMessage({ id, status: "repeated", deltas, report });
    return;
  }
  observations.clear();
  profile.reset();
  var heapBefore = allocatedBytes();
  var memoryBefore = memoryBytes();
  var started = performance.now();
  runOnce(id, target, bytes);
  var milliseconds = performance.now() - started;
  var grown = memoryBytes() - memoryBefore;
  var leaked = sanitized ? allocatedBytes() - heapBefore : null;
  // Coarse buckets steer the corpus toward slow and memory-hungry inputs,
  // where denial of service hides.
  observations.add(`time 2^${Math.round(Math.log2(milliseconds + 1))}`);
  if (grown > 0) observations.add(`grew 2^${Math.round(Math.log2(grown))}`);
  if (leaked > 0) observations.add(`left 2^${Math.round(Math.log2(leaked))}`);
  parentPort.postMessage({
    id,
    status: "done",
    observations: [...observations],
    milliseconds,
    grown,
    leaked,
    memory: memoryBytes(),
    slowest: profile.slowest,
    hungriest: profile.hungriest,
  });
});

parentPort.postMessage({ status: "ready", sanitized });
