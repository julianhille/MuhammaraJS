#!/usr/bin/env node
// Mutation fuzzer for the Wasm package. See tests/fuzz/README.md.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { createMuhammaraWasm } from "../../index.js";
import { createRandom, mutate } from "./mutate.mjs";
import { loadSeeds } from "./seeds.mjs";
import { targets } from "./targets.mjs";

var here = path.dirname(fileURLToPath(import.meta.url));
var { values: options, positionals } = parseArgs({
  allowPositionals: true,
  allowNegative: true,
  options: {
    targets: { type: "string", default: Object.keys(targets).join(",") },
    time: { type: "string", default: "60" },
    iterations: { type: "string" },
    jobs: {
      type: "string",
      default: String(Math.max(1, os.availableParallelism() - 1)),
    },
    seed: { type: "string" },
    timeout: { type: "string", default: "20000" },
    recycle: { type: "string", default: "250" },
    slow: { type: "string" },
    memory: { type: "string" },
    leaks: { type: "boolean", default: true },
    "dos-seeds": { type: "boolean", default: true },
    repeat: { type: "string", default: "4" },
    out: { type: "string", default: path.join(here, "findings") },
    "report-only": { type: "string", default: "" },
    replay: { type: "boolean", default: false },
    sequence: { type: "boolean", default: false },
    quiet: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (options.help) {
  console.log(`usage: fuzz.mjs [options]
       fuzz.mjs --replay [--targets t1,t2] file-or-directory...

  --targets list    Targets to fuzz (${Object.keys(targets).join(", ")})
  --time seconds    Stop after this long (default 60; 0 runs until stopped)
  --iterations n    Stop after this many inputs instead
  --jobs n          Parallel workers (default: CPUs - 1)
  --seed n          PRNG seed, for reproducible runs
  --timeout ms      Per-input time limit before an input counts as a hang
  --recycle n       Restart each worker after n inputs (bounds slow leaks)
  --slow ms         Report inputs with one API call that takes longer, plus
                    200 ms per MB of input (default 2000; off under
                    AddressSanitizer unless given)
  --memory mb       Report inputs that grow Wasm memory by more, plus 8 times
                    the input size (default 128; off under AddressSanitizer
                    unless given)
  --no-leaks        Do not confirm leaks (AddressSanitizer builds only)
  --no-dos-seeds    Leave out the seeds shaped like denial-of-service
                    patterns, which are slow under AddressSanitizer
  --repeat n        Runs of a leak candidate in a fresh instance (default 4)
  --out dir         Where findings are written (default tests/fuzz/findings)
  --report-only list
                    Finding kinds that are written but do not fail the run,
                    such as slow,memory,growth for a scheduled job
  --replay          Run the given files (or the .bin files in the given
                    directories) once each instead of fuzzing
  --sequence        Run the given files in order in one instance of the first
                    selected target, as a crash's saved history`);
  process.exit(0);
}

var selected = options.targets.split(",").filter(Boolean);
for (var name of selected) {
  if (!targets[name]) throw new Error(`unknown target ${name}`);
}
var reportOnly = new Set(options["report-only"].split(",").filter(Boolean));
var jobs = Math.max(1, Number(options.jobs));
var timeout = Number(options.timeout);
var recycle = Math.max(1, Number(options.recycle));
var repeat = Math.max(2, Number(options.repeat));
// Timing and memory under AddressSanitizer say more about the sanitizer than
// about the library, so those checks only run there when asked for.
var slowLimit = options.slow === undefined ? null : Number(options.slow);
var memoryLimit =
  options.memory === undefined ? null : Number(options.memory) * 1048576;
var seed =
  options.seed === undefined ? Date.now() % 2 ** 31 : Number(options.seed);
var random = createRandom(seed);

/**
 * One worker thread per target. Without AddressSanitizer an out-of-bounds
 * write corrupts the heap silently and crashes a later, unrelated input, so
 * targets never share an instance and the culprit stays in its own target.
 */
class Runner {
  /**
   * Creates a runner with no workers; they start on first use.
   */
  constructor() {
    this.workers = new Map();
  }

  /**
   * Terminates every worker.
   * @async
   * @returns {Promise<void>} Resolves when all workers have exited.
   */
  async stop() {
    await Promise.all(
      [...this.workers.values()].map((slot) => slot.worker.terminate()),
    );
    this.workers.clear();
  }

  /**
   * Returns the target's worker slot, starting a fresh worker when there is
   * none yet or the current one has served `--recycle` inputs.
   * @async
   * @param {string} target - Target name.
   * @returns {Promise<object>} The slot: the worker, its served count,
   *   captured console output, input history and whether it is sanitized.
   */
  async slot(target) {
    var slot = this.workers.get(target);
    if (slot && slot.served < recycle) return slot;
    if (slot) await this.drop(target);
    slot = { served: 0, output: "", history: [] };
    slot.worker = new Worker(path.join(here, "worker.mjs"), {
      workerData: { recipe: target === "recipe" },
      stdout: true,
      stderr: true,
    });
    /**
     * Appends worker console output to the slot, keeping the last 32 KiB.
     * @param {Buffer|string} chunk - Console output.
     */
    var capture = (chunk) => {
      // Sanitizer reports arrive on the console; keep the tail for findings.
      slot.output = (slot.output + chunk).slice(-32768);
    };
    slot.worker.stdout.on("data", capture);
    slot.worker.stderr.on("data", capture);
    await new Promise((resolve, reject) => {
      /**
       * Resolves once the worker reports that it is ready.
       * @param {object} message - Worker message.
       */
      var onMessage = (message) => {
        if (message.status !== "ready") return;
        slot.sanitized = message.sanitized;
        slot.worker.off("message", onMessage);
        slot.worker.off("error", reject);
        resolve();
      };
      slot.worker.on("message", onMessage);
      slot.worker.once("error", reject);
    });
    this.workers.set(target, slot);
    return slot;
  }

  /**
   * Terminates the target's worker, so the next input gets a fresh instance.
   * @async
   * @param {string} target - Target name.
   * @returns {Promise<void>} Resolves when the worker has exited.
   */
  async drop(target) {
    var slot = this.workers.get(target);
    this.workers.delete(target);
    if (slot) await slot.worker.terminate();
  }

  /**
   * Runs one input. Resolves with the worker's report, or a synthesized
   * timeout or crash finding; never rejects.
   * @param {string} target - Target name.
   * @param {Uint8Array} bytes - Input.
   * @returns {Promise<object>} Outcome.
   */
  async run(target, bytes) {
    // Every input this instance ran, so a crash that needs earlier inputs can
    // be replayed with them; instances restart after --recycle inputs.
    var history = (await this.slot(target)).history;
    history.push(bytes);
    var outcome = await this.send(target, { target, bytes }, timeout);
    outcome.history = history;
    return outcome;
  }

  /**
   * Runs one input `count` times in a fresh instance, for leak confirmation.
   * @param {string} target - Target name.
   * @param {Uint8Array} bytes - Input.
   * @param {number} count - Runs.
   * @returns {Promise<object>} The heap growth of each run and the new
   *   LeakSanitizer records, or a finding.
   */
  async repeat(target, bytes, count) {
    await this.drop(target);
    var outcome = await this.send(
      target,
      { target, bytes, repeat: count },
      timeout * count,
    );
    // The instance holds what the repeats leaked; start the next input clean.
    await this.drop(target);
    return outcome;
  }

  /**
   * Posts a message to the target's worker and waits for its reply, turning a
   * timeout, error or exit into a finding. Drops the worker after a finding
   * or once its memory grows large.
   * @async
   * @param {string} target - Target name.
   * @param {object} message - The message for the worker.
   * @param {number} limit - Milliseconds before the input counts as a hang.
   * @returns {Promise<object>} The worker's reply or a synthesized finding;
   *   never rejects.
   */
  async send(target, message, limit) {
    var slot = await this.slot(target);
    ++slot.served;
    slot.output = "";
    var worker = slot.worker;
    var outcome = await new Promise((resolve) => {
      var timer = setTimeout(() => {
        cleanup();
        resolve({
          status: "finding",
          kind: "timeout",
          message: `no result after ${limit} ms`,
        });
      }, limit);
      /**
       * Resolves with the worker's reply.
       * @param {object} reply - Worker report.
       */
      var onMessage = (reply) => {
        cleanup();
        resolve(reply);
      };
      /**
       * Resolves with an oom or worker-crash finding.
       * @param {Error} error - The worker's uncaught error.
       */
      var onError = (error) => {
        cleanup();
        resolve({
          status: "finding",
          kind: /memory|heap/i.test(String(error?.message))
            ? "oom"
            : "worker-crash",
          message: String(error?.message ?? error),
          stack: String(error?.stack ?? ""),
        });
      };
      /**
       * Resolves with a worker-exit finding.
       * @param {number} code - The worker's exit code.
       */
      var onExit = (code) => {
        cleanup();
        resolve({
          status: "finding",
          kind: "worker-exit",
          message: `worker exited with ${code}`,
        });
      };
      /**
       * Clears the timer and removes the worker listeners.
       */
      function cleanup() {
        clearTimeout(timer);
        worker.off("message", onMessage);
        worker.off("error", onError);
        worker.off("exit", onExit);
      }
      worker.on("message", onMessage);
      worker.on("error", onError);
      worker.on("exit", onExit);
      worker.postMessage(message);
    });
    outcome.sanitized = slot.sanitized;
    if (outcome.status === "finding") {
      // Give captured console output a moment to drain before it is read.
      await new Promise((resolve) => setTimeout(resolve, 50));
      outcome.output = slot.output;
      await this.drop(target);
    } else if (outcome.memory > (slot.sanitized ? 1024 : 256) * 1048576) {
      // Memory never shrinks; a fresh instance keeps growth measurable.
      await this.drop(target);
    }
    return outcome;
  }
}

/**
 * Builds a key that groups findings by where they happen: the kind plus the
 * innermost Wasm or library frames, with addresses and offsets removed.
 * @param {object} finding - Worker report.
 * @returns {string} The key.
 */
function findingKey(finding) {
  var frames = String(finding.stack || "")
    .split("\n")
    .filter((line) => /wasm-function|\.wasm|\/lib\/|index\.js/.test(line))
    .slice(0, 4)
    .map((line) =>
      line
        .replace(/:\d+(:\d+)?\)?$/, "")
        .replace(/0x[0-9a-f]+/gi, "")
        .trim(),
    );
  var message = String(finding.message).replace(/\d+/g, "N").slice(0, 120);
  return `${finding.kind}|${message}|${frames.join("|")}`;
}

/**
 * Groups leak findings by where the first new leak was allocated, skipping
 * the allocator's own frames.
 * @param {string} target - Target name.
 * @param {string[]} report - LeakSanitizer records.
 * @returns {string} The key.
 */
function leakKey(target, report) {
  if (!report.length) return `${target}|growth`;
  var frames = report[0]
    .split("\n")
    .filter((line) => /^\s+#\d+ /.test(line))
    .map((line) => line.replace(/^\s+#\d+ 0x[0-9a-f]+ in /i, "").trim())
    .map((line) => line.replace(/\+0x[0-9a-f]+.*$/i, ""))
    .filter((line) => !/^(?:malloc|calloc|realloc|operator new)/.test(line))
    .slice(0, 4);
  return `leak|${frames.join("|")}`;
}

/**
 * Shortens a value to the first 12 hex digits of its SHA-256, for file names.
 * @param {string} value - Value to hash.
 * @returns {string} The short hash.
 */
function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

/**
 * Runs each positional file (or the .bin files in each directory) once in a
 * fresh instance, and under `--leaks` checks that it does not leak.
 * @async
 * @returns {Promise<void>} Resolves when done; sets the exit code on failures.
 */
async function replay() {
  var runner = new Runner();
  var failures = 0;
  // A directory replays every .bin file in it, so callers need no shell glob.
  var files = positionals.flatMap((entry) =>
    fs.statSync(entry).isDirectory()
      ? fs
          .readdirSync(entry)
          .filter((name) => name.endsWith(".bin"))
          .sort()
          .map((name) => path.join(entry, name))
      : [entry],
  );
  for (var file of files) {
    var bytes = new Uint8Array(fs.readFileSync(file));
    // A finding's file name records its target; other files run on every
    // selected target.
    var fileTarget = Object.keys(targets).find((name) =>
      path.basename(file).startsWith(`${name}-`),
    );
    for (var target of fileTarget ? [fileTarget] : selected) {
      // Every file starts from a fresh instance, as a finding is confirmed.
      await runner.drop(target);
      var started = performance.now();
      var outcome = await runner.run(target, bytes);
      var elapsed = Math.round(performance.now() - started);
      if (outcome.status === "finding") {
        ++failures;
        console.log(
          `FAIL ${file} [${target}] ${outcome.kind}: ${outcome.message} (${elapsed} ms)`,
        );
        if (outcome.stack)
          console.log(outcome.stack.split("\n").slice(0, 12).join("\n"));
        if (outcome.output) console.log(outcome.output.slice(-4000));
      } else if (options.leaks && outcome.leaked > 0) {
        // Under AddressSanitizer a regression input must not leak either.
        var repeated = await runner.repeat(target, bytes, repeat);
        var steady = repeated.deltas?.slice(1) ?? [];
        if (steady.length && steady.every((delta) => delta > 0)) {
          ++failures;
          console.log(
            `FAIL ${file} [${target}] leak: ${Math.min(...steady)} bytes per run`,
          );
          if (repeated.report.length) console.log(repeated.report[0]);
        } else {
          console.log(`ok   ${file} [${target}] (${elapsed} ms)`);
        }
      } else {
        console.log(`ok   ${file} [${target}] (${elapsed} ms)`);
      }
    }
  }
  await runner.stop();
  process.exitCode = failures ? 1 : 0;
}

/**
 * Fuzzes the selected targets with `--jobs` runners until the time or
 * iteration limit, then prints a summary and sets the exit code.
 * @async
 * @returns {Promise<void>} Resolves when the run is over.
 */
async function fuzz() {
  var seedApi = await createMuhammaraWasm({ recryptWorker: false });
  var seedsByKind = {};
  var corpora = {};
  var seen = {};
  for (var target of selected) {
    var kind = targets[target].seeds;
    seedsByKind[kind] ??= loadSeeds(kind, seedApi).filter(
      (entry) => options["dos-seeds"] || !entry.name.startsWith("dos-"),
    );
    corpora[target] = seedsByKind[kind].map((entry) => entry.bytes);
    seen[target] = new Set();
  }
  console.log(
    `seed ${seed}; ${jobs} worker(s); targets ${selected
      .map((target) => `${target} (${corpora[target].length} seeds)`)
      .join(", ")}`,
  );
  fs.mkdirSync(options.out, { recursive: true });

  var deadline =
    Number(options.time) > 0
      ? Date.now() + Number(options.time) * 1000
      : Infinity;
  var limit =
    options.iterations === undefined ? Infinity : Number(options.iterations);
  var executed = 0;
  var findings = new Map();
  var leakChecks = new Set();
  var checks = { candidates: 0, leakRuns: 0, slow: 0, memory: 0 };
  var stats = Object.fromEntries(selected.map((target) => [target, 0]));
  var startedAt = Date.now();
  var stopping = false;
  process.once("SIGINT", () => {
    stopping = true;
  });

  var report = setInterval(() => {
    if (options.quiet) return;
    var seconds = (Date.now() - startedAt) / 1000;
    console.log(
      `[${Math.round(seconds)}s] ${executed} execs (${(executed / seconds).toFixed(1)}/s), corpus ${selected
        .map((target) => `${target}=${corpora[target].length}`)
        .join(" ")}, findings ${findings.size}`,
    );
  }, 10000);

  /**
   * Mutates corpus inputs and runs them on one runner until the run stops,
   * growing the corpus with inputs that show new behavior and recording
   * findings.
   * @async
   * @param {Runner} runner - The runner for this job.
   * @returns {Promise<void>} Resolves when the run stops.
   */
  async function loop(runner) {
    while (!stopping && Date.now() < deadline && executed < limit) {
      var target = selected[executed % selected.length];
      ++executed;
      ++stats[target];
      var corpus = corpora[target];
      // Tournament of two: the smaller input wins, so fast inputs are
      // mutated most and a few large or slow ones do not eat the run.
      var parent = random.pick(corpus);
      var rival = random.pick(corpus);
      if (rival.length < parent.length) parent = rival;
      var { bytes, steps } = mutate(parent, random, {
        text: targets[target].seeds === "pdf",
        kind: targets[target].seeds,
        splicePool: corpus,
      });
      var outcome = await runner.run(target, bytes);
      if (outcome.status === "done") {
        var novel = outcome.observations.some(
          (entry) => !seen[target].has(entry),
        );
        outcome.observations.forEach((entry) => seen[target].add(entry));
        if (novel && corpus.length < 4000 && bytes.length <= 4 << 20)
          corpus.push(bytes);
        await checkResources(runner, target, bytes, steps, outcome);
        continue;
      }
      // Confirm in a fresh worker: a finding that needs earlier inputs in the
      // same instance is still reported, but marked as not reproducing alone.
      await runner.drop(target);
      var confirm = await runner.run(target, bytes);
      // Keyed by target too: hangs and worker exits carry no stack, so one
      // target's would otherwise hide another's.
      var id = record(`${target}|${findingKey(outcome)}`, bytes, {
        target,
        kind: outcome.kind,
        message: outcome.message,
        reproducesAlone: confirm.status === "finding",
        mutations: steps,
        stack: outcome.stack,
        output: outcome.output,
      });
      if (id && confirm.status !== "finding") {
        // An earlier input corrupted the instance: keep what it ran, for
        // --sequence under AddressSanitizer.
        var directory = path.join(options.out, `${id}.history`);
        fs.mkdirSync(directory, { recursive: true });
        outcome.history.forEach((input, index) =>
          fs.writeFileSync(
            path.join(directory, `${String(index).padStart(4, "0")}.bin`),
            input,
          ),
        );
        console.log(
          `  ${outcome.history.length} inputs that led to it: ${directory}`,
        );
      }
    }
  }

  /**
   * Looks for denial of service and leaks in an input that finished: too
   * slow, too much memory, or heap left allocated after everything it
   * created was released. Each is confirmed in a fresh instance.
   * @async
   * @param {Runner} runner - The runner that ran the input.
   * @param {string} target - Target name.
   * @param {Uint8Array} bytes - Input.
   * @param {string[]} steps - The mutations that produced the input.
   * @param {object} outcome - The worker's report for the input.
   * @returns {Promise<void>} Resolves when the checks are done.
   */
  async function checkResources(runner, target, bytes, steps, outcome) {
    // Work in proportion to the input is no denial of service; the limits
    // grow with input size and catch amplification.
    var megabytes = bytes.length / 1048576;
    var slow = slowLimit ?? (outcome.sanitized ? null : 2000);
    if (slow !== null) slow += 200 * megabytes;
    var memory = memoryLimit ?? (outcome.sanitized ? null : 128 * 1048576);
    if (memory !== null) memory += 8 * bytes.length;
    var size = `${bytes.length} input bytes`;
    // One call over the limit counts, not the input's total: the targets
    // make hundreds of calls per input.
    if (slow !== null && outcome.slowest.milliseconds > slow) {
      ++checks.slow;
      await runner.drop(target);
      var again = await runner.run(target, bytes);
      if (again.status === "done" && again.slowest.milliseconds > slow) {
        var milliseconds = Math.min(
          outcome.slowest.milliseconds,
          again.slowest.milliseconds,
        );
        // Keyed by the step that took the time, so one known slow call does
        // not hide another.
        var step = again.slowest.step || outcome.slowest.step;
        record(`${target}|slow|${step}`, bytes, {
          target,
          kind: "slow",
          step,
          message: `${Math.round(milliseconds)} ms in one call for ${size}: ${step}`,
          severity: milliseconds,
          reproducesAlone: true,
          mutations: steps,
        });
      }
    }
    if (memory !== null && outcome.grown > memory) {
      ++checks.memory;
      await runner.drop(target);
      var fresh = await runner.run(target, bytes);
      if (fresh.status === "done" && fresh.grown > memory) {
        var hungriest = fresh.hungriest.step || outcome.hungriest.step;
        record(`${target}|memory|${hungriest}`, bytes, {
          target,
          kind: "memory",
          step: hungriest,
          message: `grew Wasm memory by ${Math.round(fresh.grown / 1048576)} MB for ${size}, in ${hungriest}`,
          severity: fresh.grown,
          reproducesAlone: true,
          mutations: steps,
        });
      }
    }
    if (!options.leaks || !(outcome.leaked > 0)) return;
    ++checks.candidates;
    // Confirm once per target and set of rejections, so one leaky error path
    // is not re-run for every input that takes it.
    var rejections = outcome.observations
      .filter(
        (entry) => !/^(?:time|grew|left|type|stream|pages|text) /.test(entry),
      )
      .sort()
      .join("\n");
    var checkKey = `${target}\n${rejections}`;
    if (leakChecks.has(checkKey)) return;
    leakChecks.add(checkKey);
    ++checks.leakRuns;
    var repeated = await runner.repeat(target, bytes, repeat);
    if (repeated.status !== "repeated") return;
    // The first run may fill caches; a leak grows the heap on every repeat.
    var steady = repeated.deltas.slice(1);
    if (!steady.every((delta) => delta > 0)) return;
    var perRun = Math.min(...steady);
    record(leakKey(target, repeated.report), bytes, {
      target,
      kind: repeated.report.length ? "leak" : "growth",
      message: repeated.report.length
        ? `leaks ${perRun} bytes per run`
        : `heap grows ${perRun} bytes per run, still reachable`,
      severity: perRun,
      reproducesAlone: true,
      mutations: steps,
      deltas: repeated.deltas,
      output: repeated.report.join("\n\n"),
    });
  }

  /**
   * Writes a finding once per key. Slow, memory and leak findings keep the
   * worst input seen for their key.
   * @param {string} key - Grouping key of the finding.
   * @param {Uint8Array} bytes - Input.
   * @param {object} details - Finding details written to its .json file.
   * @returns {string|undefined} The id of a new finding, or undefined when
   *   the key was already recorded.
   */
  function record(key, bytes, details) {
    var existing = findings.get(key);
    if (existing) {
      existing.count++;
      if (!(details.severity > (existing.severity ?? Infinity))) return;
      details.count = existing.count;
      details.id = existing.id;
    }
    var id = details.id ?? `${details.target}-${details.kind}-${hash(key)}`;
    var entry = { id, ...details, seed, count: details.count ?? 1 };
    findings.set(key, entry);
    fs.writeFileSync(path.join(options.out, `${id}.bin`), bytes);
    fs.writeFileSync(
      path.join(options.out, `${id}.json`),
      JSON.stringify(entry, null, 2),
    );
    // A worse input for a known slow, memory or leak finding replaces its
    // files quietly.
    if (existing) return undefined;
    console.log(
      `\nFINDING ${id}: ${entry.kind}: ${entry.message}${entry.reproducesAlone ? "" : " (did not reproduce alone)"}`,
    );
    if (entry.stack)
      console.log(entry.stack.split("\n").slice(0, 8).join("\n"));
    if (entry.kind === "leak") console.log(entry.output.slice(0, 2000));
    return id;
  }

  var runners = Array.from({ length: jobs }, () => new Runner());
  await Promise.all(runners.map((runner) => loop(runner)));
  await Promise.all(runners.map((runner) => runner.stop()));
  clearInterval(report);
  var seconds = (Date.now() - startedAt) / 1000;
  console.log(
    `\n${executed} execs in ${seconds.toFixed(0)}s (${Object.entries(stats)
      .map(([target, count]) => `${target}=${count}`)
      .join(" ")}); ${findings.size} unique finding(s)`,
  );
  console.log(
    `checked: ${checks.candidates} inputs left heap behind, ${checks.leakRuns} confirmed by repeating; ${checks.slow} slow and ${checks.memory} memory-hungry inputs rerun`,
  );
  for (var record of findings.values()) {
    console.log(`  ${record.id} x${record.count}: ${record.message}`);
  }
  var failing = [...findings.values()].filter(
    (entry) => !reportOnly.has(entry.kind),
  );
  process.exitCode = failing.length ? 1 : 0;
}

/**
 * Runs files in order in one instance and reports the first finding, to find
 * which input of a saved history corrupted the instance.
 * @async
 * @returns {Promise<void>} Resolves when done; sets the exit code on a
 *   finding.
 */
async function sequence() {
  var target = selected[0];
  var files = positionals.flatMap((entry) =>
    fs.statSync(entry).isDirectory()
      ? fs
          .readdirSync(entry)
          .filter((name) => name.endsWith(".bin"))
          .sort()
          .map((name) => path.join(entry, name))
      : [entry],
  );
  var runner = new Runner();
  for (var [index, file] of files.entries()) {
    var outcome = await runner.run(
      target,
      new Uint8Array(fs.readFileSync(file)),
    );
    if (outcome.status === "finding") {
      console.log(
        `FAIL at ${index + 1}/${files.length} ${file} [${target}] ${outcome.kind}: ${outcome.message}`,
      );
      if (outcome.stack)
        console.log(outcome.stack.split("\n").slice(0, 12).join("\n"));
      if (outcome.output) console.log(outcome.output.slice(-6000));
      process.exitCode = 1;
      break;
    }
  }
  await runner.stop();
  if (!process.exitCode) console.log(`ok   ${files.length} inputs [${target}]`);
}

if (options.replay) await replay();
else if (options.sequence) await sequence();
else await fuzz();
