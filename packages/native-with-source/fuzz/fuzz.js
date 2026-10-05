#!/usr/bin/env node
"use strict";

// Mutation fuzzer for the native addon. It looks for crashes, memory leaks
// and denial of service (hangs, slow cases and memory blowups).
//
//   node fuzz/fuzz.js [--target name[,name]] [--iterations n] [--jobs n]
//                     [--seed n] [--timeout ms] [--slow ms] [--rss mb]
//                     [--leaks] [--batch n] [--out dir]
//   node fuzz/fuzz.js --replay file [--target name]
//
// Each job is a child process that mutates seed files from TestMaterials and
// runs them through a target from targets.js. Before every case the child
// writes the input to <out>/current-<job>.bin, so when it dies on a signal, a
// sanitizer report or a hang, the parent keeps that file under <out>/crashes
// and starts a fresh child. With --leaks, children run batches of cases with
// LeakSanitizer on, and the parent replays a leaking batch one case at a time
// to find the inputs that leak. Build with -fsanitize=address,undefined (see
// the sanitizer job in .github/workflows/ci-native.yml); see README.md.

var childProcess = require("child_process");
var fs = require("fs");
var path = require("path");

/**
 * Parses the command line into fuzzer options, starting from the defaults.
 *
 * @param {string[]} argv - The process arguments, `process.argv` style.
 * @returns {object} The options, keyed by option name without the `--`.
 */
function parseArgs(argv) {
  var args = {
    target: null,
    iterations: 2000,
    jobs: require("os").availableParallelism(),
    seed: Date.now() >>> 0,
    timeout: 20000,
    slow: 5000,
    rss: 2048,
    leaks: false,
    batch: 50,
    out: path.join(__dirname, "out"),
    replay: null,
    job: 0,
    worker: false,
  };
  for (var i = 2; i < argv.length; ++i) {
    var key = argv[i].replace(/^--/, "");
    if (key === "worker" || key === "leaks") args[key] = true;
    else if (key in args) {
      var value = argv[++i];
      args[key] = typeof args[key] === "number" ? Number(value) : value;
    } else throw new Error("Unknown option " + argv[i]);
  }
  return args;
}

/**
 * Creates an xorshift32 random number generator, so a job's run can be
 * reproduced from its seed.
 *
 * @param {number} seed - The 32-bit seed; 0 is replaced with 1.
 * @returns {Function} A function returning a float in [0, 1), with `int` and
 *   `pick` helpers attached.
 */
function random(seed) {
  var state = seed || 1;
  /**
   * Advances the generator state.
   *
   * @returns {number} The next float in [0, 1).
   */
  function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  }
  /**
   * Draws a random integer below `n`.
   *
   * @param {number} n - The exclusive upper bound.
   * @returns {number} An integer in [0, n).
   */
  next.int = function (n) {
    return Math.floor(next() * n);
  };
  /**
   * Picks a random element of an array.
   *
   * @param {Array} items - The array to pick from.
   * @returns {*} One of `items`.
   */
  next.pick = function (items) {
    return items[next.int(items.length)];
  };
  return next;
}

var interestingNumbers = [
  "0",
  "-1",
  "1",
  "-0",
  "2147483647",
  "2147483648",
  "-2147483648",
  "4294967295",
  "4294967296",
  "9223372036854775807",
  "1e308",
  "99999999999",
  "65535",
  "65536",
  "255",
  "256",
  "0.0000001",
  "-99999",
  "3.4e38",
  "NaN",
];
var pdfTokens = [
  "obj",
  "endobj",
  "stream",
  "endstream",
  "R",
  "<<",
  ">>",
  "[",
  "]",
  "(",
  ")",
  "<",
  ">",
  "/Length",
  "/Filter",
  "/FlateDecode",
  "/LZWDecode",
  "/ASCIIHexDecode",
  "/ASCII85Decode",
  "/DCTDecode",
  "/DecodeParms",
  "/Predictor 15",
  "/Columns",
  "/Type",
  "/Page",
  "/Pages",
  "/Kids",
  "/Count",
  "/Parent",
  "/Contents",
  "/Resources",
  "/Font",
  "/XObject",
  "/MediaBox",
  "/Encrypt",
  "/ObjStm",
  "/N",
  "/First",
  "/XRef",
  "/W",
  "/Index",
  "/Prev",
  "/Size",
  "/Root",
  "xref",
  "trailer",
  "startxref",
  "BT",
  "ET",
  "Tj",
  "TJ",
  "Tf",
  "Do",
  "q",
  "Q",
  "cm",
  "/ToUnicode",
  "/Encoding",
  "/Differences",
  "/Widths",
  "/FirstChar",
  "/DescendantFonts",
  "/CIDToGIDMap",
  "beginbfchar",
  "endbfchar",
  "beginbfrange",
  "endbfrange",
  "begincodespacerange",
  "endcodespacerange",
  "null",
  "true",
  "false",
  "%%EOF",
  "\\",
  "\\(",
  "#00",
  "#",
];
var interestingBytes = [0, 1, 0x7f, 0x80, 0xfe, 0xff];

/**
 * Applies one mutation to a Buffer: byte-level havoc, plus token-aware edits
 * that keep enough PDF structure for the input to reach the deeper parsers.
 *
 * @param {Function} rng - The generator from `random()`.
 * @param {Buffer} data - The input to mutate; it is not modified.
 * @param {Buffer[]} others - The corpus to splice chunks from.
 * @param {boolean} textual - Whether number and PDF-token edits are allowed.
 * @returns {Buffer} The mutated input.
 */
function mutateOnce(rng, data, others, textual) {
  var length = data.length;
  var at = length ? rng.int(length) : 0;
  var kind = rng.int(textual ? 11 : 8);
  switch (kind) {
    case 0: {
      var flipped = Buffer.from(data);
      if (length) flipped[at] ^= 1 << rng.int(8);
      return flipped;
    }
    case 1: {
      var set = Buffer.from(data);
      if (length) set[at] = rng.pick(interestingBytes.concat([rng.int(256)]));
      return set;
    }
    case 2: {
      // Overwrite 2 or 4 bytes with a boundary value, either endianness.
      var word = Buffer.from(data);
      var size = rng.pick([2, 4]);
      if (length >= size) {
        var pos = rng.int(length - size + 1);
        var value = rng.pick([
          0, 0xffffffff, 0x7fffffff, 0x80000000, 0xffff, 0x8000, 1,
        ]);
        if (size === 2) value &= 0xffff;
        if (rng.int(2)) word.writeUIntBE(value >>> 0, pos, size);
        else word.writeUIntLE(value >>> 0, pos, size);
      }
      return word;
    }
    case 3:
      // Delete a chunk.
      return Buffer.concat([
        data.subarray(0, at),
        data.subarray(Math.min(length, at + 1 + rng.int(256))),
      ]);
    case 4: {
      // Duplicate a chunk.
      var from = length ? rng.int(length) : 0;
      var chunk = data.subarray(from, from + 1 + rng.int(512));
      return Buffer.concat([data.subarray(0, at), chunk, data.subarray(at)]);
    }
    case 5:
      // Truncate.
      return data.subarray(0, at);
    case 6: {
      // Splice with another seed.
      var other = rng.pick(others);
      var start = rng.int(other.length);
      return Buffer.concat([
        data.subarray(0, at),
        other.subarray(start, start + 1 + rng.int(4096)),
        data.subarray(Math.min(length, at + rng.int(4096))),
      ]);
    }
    case 7: {
      // Random bytes.
      var noise = Buffer.alloc(1 + rng.int(32));
      for (var i = 0; i < noise.length; ++i) noise[i] = rng.int(256);
      return Buffer.concat([data.subarray(0, at), noise, data.subarray(at)]);
    }
    case 8:
    case 9: {
      // Replace a number with a boundary value.
      var text = data.toString("latin1");
      var re = /-?\d+(\.\d+)?/g;
      re.lastIndex = at;
      var match = re.exec(text) || /-?\d+/.exec(text);
      if (!match) return data;
      return Buffer.from(
        text.slice(0, match.index) +
          rng.pick(interestingNumbers) +
          text.slice(match.index + match[0].length),
        "latin1",
      );
    }
    default: {
      // Insert a PDF token.
      return Buffer.concat([
        data.subarray(0, at),
        Buffer.from(" " + rng.pick(pdfTokens) + " ", "latin1"),
        data.subarray(at),
      ]);
    }
  }
}

/**
 * Applies a random number of stacked mutations to an input.
 *
 * @param {Function} rng - The generator from `random()`.
 * @param {Buffer} data - The input to mutate; it is not modified.
 * @param {Buffer[]} others - The corpus to splice chunks from.
 * @param {boolean} textual - Whether number and PDF-token edits are allowed.
 * @returns {Buffer} The mutated input.
 */
function mutate(rng, data, others, textual) {
  var rounds = 1 + rng.int(rng.int(2) ? 4 : 16);
  for (var i = 0; i < rounds; ++i)
    data = mutateOnce(rng, data, others, textual);
  return data;
}

/**
 * Rewrites a PDF seed without compression. PDF seeds are mostly compressed;
 * an uncompressed copy of each, written by the addon itself so its xref stays
 * valid, lets the text mutations reach page dictionaries and content streams.
 *
 * @param {Buffer} data - The PDF seed.
 * @returns {Buffer|null} The uncompressed PDF, or null when the addon rejects
 *   the seed.
 */
function uncompressedSeed(data) {
  var muhammara = require("..");
  try {
    var output = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(output, { compress: false });
    writer.appendPDFPagesFromPDF(new muhammara.PDFRStreamForBuffer(data));
    writer.end();
    return output.buffer;
  } catch (error) {
    return null;
  }
}

/**
 * Copies an input, its target name and a log into the crashes directory.
 *
 * @param {{out: string, job: number}} args - The output directory and job index.
 * @param {string} kind - The finding kind, used as file name prefix.
 * @param {Buffer} data - The input that triggered the finding.
 * @param {string} target - The name of the target the input ran through.
 * @param {string} log - The log text to store next to the input.
 * @returns {string} The base file name the finding was saved under.
 */
function save(args, kind, data, target, log) {
  var crashes = path.join(args.out, "crashes");
  fs.mkdirSync(crashes, { recursive: true });
  var name =
    kind +
    "-" +
    Date.now() +
    "-" +
    args.job +
    "-" +
    Math.floor(Math.random() * 1e6);
  fs.writeFileSync(path.join(crashes, name + ".bin"), data);
  fs.writeFileSync(path.join(crashes, name + ".bin.target"), target);
  fs.writeFileSync(path.join(crashes, name + ".log"), log);
  return name;
}

/**
 * Runs the finalizers of collected native objects before exiting, so that
 * LeakSanitizer only reports memory that nothing can free any more.
 *
 * @param {number} code - The exit code to set.
 */
function collectAndExit(code) {
  global.gc();
  setImmediate(function () {
    global.gc();
    setImmediate(function () {
      global.gc();
      process.exitCode = code;
    });
  });
}

/**
 * Runs the child side: mutates seeds and feeds them to the targets, writing
 * each case to disk first and reporting progress to the parent.
 *
 * @param {object} args - The parsed options from `parseArgs()`.
 */
function runWorker(args) {
  var targets = require("./targets");
  var names = args.target.split(",");
  var rng = random(args.seed);
  var corpus = {};
  var uncompressed = fs
    .readdirSync(path.join(args.out, "seeds"))
    .map(function (file) {
      return fs.readFileSync(path.join(args.out, "seeds", file));
    });
  names.forEach(function (name) {
    var target = targets[name];
    var data = target.seeds.map(function (file) {
      return fs.readFileSync(file);
    });
    if (target.pdf) data = data.concat(uncompressed);
    // Targets whose inputs aren't files, such as content streams, make theirs.
    if (target.seedData) data = data.concat(target.seedData(uncompressed));
    corpus[name] = data;
  });
  var current = path.join(args.out, "current-" + args.job + ".bin");
  var batchDir = path.join(args.out, "batch-" + args.job);
  if (args.leaks) {
    fs.rmSync(batchDir, { recursive: true, force: true });
    fs.mkdirSync(batchDir, { recursive: true });
  }
  process.on("exit", targets.cleanup);
  process.send({ progress: 0 });
  for (var i = 0; i < args.iterations; ++i) {
    var name = rng.pick(names);
    var target = targets[name];
    var input = mutate(
      rng,
      rng.pick(corpus[name]),
      corpus[name],
      !!(target.pdf || target.text),
    );
    fs.writeFileSync(current, input);
    fs.writeFileSync(current + ".target", name);
    if (args.leaks) {
      fs.writeFileSync(path.join(batchDir, i + ".bin"), input);
      fs.writeFileSync(path.join(batchDir, i + ".bin.target"), name);
    }
    var started = Date.now();
    try {
      target.run(input);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
    }
    var elapsed = Date.now() - started;
    if (elapsed > args.slow)
      save(
        args,
        "slow",
        input,
        name,
        "target: " + name + "\nslow: " + elapsed + "ms\n",
      );
    if (i % 50 === 0) global.gc();
    var rss = process.memoryUsage().rss / 1048576;
    if (rss > args.rss) {
      // Retained memory, or a case that peaked high. Either way a fresh
      // worker is needed.
      save(
        args,
        "memory",
        input,
        name,
        "target: " + name + "\nrss: " + Math.round(rss) + "MB\n",
      );
      process.send({ progress: 1 });
      process.exit(0);
    }
    process.send({ progress: 1 });
  }
  if (args.leaks) collectAndExit(0);
}

/**
 * Runs one saved input through its target and prints how it ended.
 *
 * @param {object} args - The parsed options; `replay` names the input file and
 *   `target` overrides the name stored next to it.
 */
function replay(args) {
  var targets = require("./targets");
  var input = fs.readFileSync(args.replay);
  var name = args.target;
  if (!name && fs.existsSync(args.replay + ".target"))
    name = fs.readFileSync(args.replay + ".target", "utf8");
  var started = Date.now();
  try {
    targets[name].run(input);
    console.log(
      "replay finished without a crash in " + (Date.now() - started) + "ms",
    );
  } catch (error) {
    console.log("replay threw " + error.name + ": " + error.message);
  } finally {
    targets.cleanup();
  }
  if (global.gc) collectAndExit(0);
}

/**
 * Builds the environment for a child with its sanitizer options: report
 * allocations and RSS beyond the limit as findings, and leaks only in leak
 * mode. Options already set win.
 *
 * @param {object} args - The parsed options; `rss` sets the memory limits.
 * @param {boolean} leaks - Whether LeakSanitizer reports leaks.
 * @returns {object} A copy of `process.env` with `ASAN_OPTIONS` set.
 */
function childEnv(args, leaks) {
  var options = (process.env.ASAN_OPTIONS || "").split(":").filter(Boolean);
  /**
   * Sets a sanitizer option, replacing any earlier value.
   *
   * @param {string} key - The option name.
   * @param {string|number} value - The option value.
   */
  function set(key, value) {
    options = options.filter(function (option) {
      return option.split("=")[0] !== key;
    });
    options.push(key + "=" + value);
  }
  /**
   * Sets a sanitizer option unless it is already set.
   *
   * @param {string} key - The option name.
   * @param {string|number} value - The option value.
   */
  function setDefault(key, value) {
    if (!options.some((option) => option.split("=")[0] === key))
      set(key, value);
  }
  set("detect_leaks", leaks ? 1 : 0);
  setDefault("allocator_may_return_null", 0);
  setDefault("max_allocation_size_mb", args.rss);
  setDefault("hard_rss_limit_mb", args.rss * 2);
  return Object.assign({}, process.env, { ASAN_OPTIONS: options.join(":") });
}

/**
 * Summarizes a sanitizer report as its kind and first few stack frames, used
 * to drop duplicate findings.
 *
 * @param {string} log - The child's stderr output.
 * @returns {string} The signature, `kind @ frame < frame ...`.
 */
function signature(log) {
  var frames = [];
  var re = /#\d+ 0x[0-9a-f]+ in (\S+)/g;
  var match;
  while ((match = re.exec(log)) && frames.length < 4) {
    if (
      !/^(operator|__interceptor|malloc|calloc|realloc|free|__asan|__lsan|__ubsan)/.test(
        match[1],
      )
    )
      frames.push(match[1]);
  }
  var kind =
    /(ERROR: \w+Sanitizer: [\w-]+|runtime error: [a-z ]+|LeakSanitizer|timed out|terminated)/.exec(
      log,
    );
  return (kind ? kind[1] : "unknown") + " @ " + frames.join(" < ");
}

/**
 * Runs the parent side: prepares the seeds, runs the jobs as child processes
 * and records unique findings.
 *
 * @param {object} args - The parsed options from `parseArgs()`.
 * @returns {Promise<void>} Resolves when every job has finished.
 */
function runParent(args) {
  var targets = require("./targets");
  var names = args.target
    ? args.target.split(",")
    : Object.keys(targets).filter(function (key) {
        return typeof targets[key] === "object";
      });
  var seedDir = path.join(args.out, "seeds");
  fs.rmSync(seedDir, { recursive: true, force: true });
  fs.mkdirSync(seedDir, { recursive: true });
  targets["pdf-read"].seeds.forEach(function (file) {
    var seed = uncompressedSeed(fs.readFileSync(file));
    if (seed && seed.length)
      fs.writeFileSync(path.join(seedDir, path.basename(file)), seed);
  });
  targets.cleanup();
  var crashes = path.join(args.out, "crashes");
  fs.mkdirSync(crashes, { recursive: true });
  var perJob = Math.ceil(args.iterations / args.jobs);
  var done = 0;
  var found = 0;
  var duplicates = 0;
  var seen = new Set();
  var started = Date.now();

  /**
   * Saves a finding unless one with the same target and signature was seen.
   *
   * @param {number} job - The index of the job that found it.
   * @param {string} kind - The finding kind, such as `crash` or `leak`.
   * @param {string} file - The input file; `<file>.target` names its target.
   * @param {string} log - The log to save with it.
   */
  function record(job, kind, file, log) {
    var target = fs.readFileSync(file + ".target", "utf8");
    // Keyed by target too: a timeout has no stack, so one target's hang would
    // otherwise hide another's.
    var key = target + ": " + signature(log);
    if (seen.has(key)) {
      ++duplicates;
      return;
    }
    seen.add(key);
    var name = save(
      { out: args.out, job: job },
      kind,
      fs.readFileSync(file),
      target,
      log,
    );
    ++found;
    console.log("[job " + job + "] " + kind + ": " + key + " -> " + name);
  }

  /**
   * Runs one child process: a batch of cases, or a single replay.
   *
   * @param {string[]} childArgs - The child's command-line arguments.
   * @param {boolean} leaks - Whether LeakSanitizer reports leaks in the child.
   * @param {Function} [onProgress] - Called with each progress count the
   *   child sends.
   * @returns {Promise<{code: (number|null), signal: (string|null), timedOut: boolean, log: string}>}
   *   How the child exited, and its stderr.
   */
  function run(childArgs, leaks, onProgress) {
    return new Promise(function (resolve) {
      var stderr = [];
      var child = childProcess.fork(__filename, childArgs, {
        execArgv: ["--expose-gc"],
        env: childEnv(args, leaks),
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      });
      var timer;
      var timedOut = false;
      /**
       * Restarts the watchdog that kills the child when it stops reporting.
       *
       * @param {number} timeout - Milliseconds until the child is killed.
       */
      function arm(timeout) {
        clearTimeout(timer);
        timer = setTimeout(function () {
          timedOut = true;
          stderr.push("fuzz: timed out after " + timeout + "ms\n");
          child.kill("SIGKILL");
        }, timeout);
      }
      // Loading the addon and preparing seeds is slow under sanitizers.
      arm(Math.max(args.timeout, 60000));
      child.stderr.on("data", function (chunk) {
        if (stderr.length < 4096) stderr.push(chunk.toString());
      });
      child.on("message", function (message) {
        if (onProgress) onProgress(message.progress);
        arm(args.timeout);
      });
      child.on("exit", function (code, signal) {
        clearTimeout(timer);
        resolve({
          code: code,
          signal: signal,
          timedOut: timedOut,
          log: stderr.join(""),
        });
      });
    });
  }

  /**
   * Tells whether a child failed only because of a LeakSanitizer report.
   *
   * @param {{log: string}} result - The child result from `run()`.
   * @returns {boolean} True for a pure leak report.
   */
  function isLeak(result) {
    return (
      /ERROR: LeakSanitizer/.test(result.log) &&
      !/ERROR: AddressSanitizer|runtime error|timed out/.test(result.log)
    );
  }

  /**
   * Replays each case of a leaking batch alone, and records those that leak.
   *
   * @async
   * @param {number} job - The index of the job whose batch leaked.
   * @returns {Promise<void>} Resolves when every case has been replayed.
   */
  async function bisectLeaks(job) {
    var batchDir = path.join(args.out, "batch-" + job);
    var files = fs
      .readdirSync(batchDir)
      .filter((file) => file.endsWith(".bin"));
    var leaked = 0;
    for (var file of files) {
      var input = path.join(batchDir, file);
      var result = await run(["--replay", input, "--out", args.out], true);
      if (result.code !== 0 && isLeak(result)) {
        ++leaked;
        record(
          job,
          "leak",
          input,
          "target: " +
            fs.readFileSync(input + ".target", "utf8") +
            "\n\n" +
            result.log,
        );
      }
    }
    if (!leaked)
      console.log(
        "[job " + job + "] a batch leaked, but no single case did on its own",
      );
  }

  /**
   * Runs one job's share of the cases, restarting the child after each crash,
   * timeout or memory limit.
   *
   * @async
   * @param {number} job - The job index.
   * @param {number} remaining - How many cases the job still has to run.
   * @param {number} seed - The seed for the first child; later children
   *   derive theirs from it.
   * @returns {Promise<void>} Resolves when the job has run all its cases.
   */
  async function job(job, remaining, seed) {
    while (remaining > 0) {
      var count = args.leaks ? Math.min(args.batch, remaining) : remaining;
      var ran = 0;
      var result = await run(
        [
          "--worker",
          "--job",
          String(job),
          "--target",
          names.join(","),
          "--iterations",
          String(count),
          "--seed",
          String(seed),
          "--out",
          args.out,
          "--slow",
          String(args.slow),
          "--rss",
          String(args.rss),
        ].concat(args.leaks ? ["--leaks"] : []),
        args.leaks,
        function (progress) {
          ran += progress;
          done += progress;
        },
      );
      seed = (seed * 2654435761 + 1) >>> 0;
      var current = path.join(args.out, "current-" + job + ".bin");
      if (result.code === 0 && !result.signal) {
        // Fewer than count cases ran if the worker hit its memory limit.
        remaining -= ran;
        continue;
      }
      if (args.leaks && isLeak(result)) {
        remaining -= ran;
        await bisectLeaks(job);
        continue;
      }
      if (!fs.existsSync(current + ".target")) {
        // Died before the first case, e.g. while loading the addon.
        console.error(result.log);
        throw new Error("fuzz worker " + job + " failed to start");
      }
      var log =
        "target: " +
        fs.readFileSync(current + ".target", "utf8") +
        "\nexit: " +
        (result.signal || result.code) +
        "\n\n" +
        result.log;
      record(job, result.timedOut ? "timeout" : "crash", current, log);
      // The failing case consumed one iteration; carry on from the next.
      remaining -= Math.max(ran, 1);
    }
  }

  var progress = setInterval(function () {
    var seconds = (Date.now() - started) / 1000;
    console.log(
      done +
        " cases, " +
        found +
        " findings (" +
        duplicates +
        " duplicates), " +
        (done / seconds).toFixed(1) +
        " cases/s",
    );
  }, 10000);

  var jobs = [];
  for (var index = 0; index < args.jobs; ++index)
    jobs.push(job(index, perJob, (args.seed + index * 7919) >>> 0));
  return Promise.all(jobs).then(function () {
    clearInterval(progress);
    var slow = fs
      .readdirSync(crashes)
      .filter((file) => /^(slow|memory)-.*\.bin$/.test(file));
    console.log(
      "finished: " +
        done +
        " cases, " +
        found +
        " findings, " +
        slow.length +
        " slow or memory-heavy cases in " +
        crashes,
    );
    process.exitCode = found ? 1 : 0;
  });
}

var args = parseArgs(process.argv);
fs.mkdirSync(args.out, { recursive: true });
if (args.worker) runWorker(args);
else if (args.replay) replay(args);
else runParent(args);
