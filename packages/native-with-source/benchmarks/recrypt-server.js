// @ts-check
"use strict";

/**
 * Compares recrypt() and recryptAsync() inside an HTTP server.
 *
 * The server runs in a child process and serves two routes: /recrypt, which
 * re-encrypts a PDF with the requested mode, and /ping, which answers at once.
 * The driver in this process sends recrypt requests at a fixed concurrency
 * and pings the server the whole time. The ping latency is what another
 * client of the server would wait; the server reports its own event loop
 * delay and utilization.
 *
 * Usage: node benchmarks/recrypt-server.js [--input file.pdf] [--requests 16]
 *   [--concurrency 4] [--ping-interval 10] [--copies 2] [--json]
 */

var childProcess = require("child_process");
var fs = require("fs");
var http = require("http");
var os = require("os");
var path = require("path");
var perfHooks = require("perf_hooks");

/** @typedef {"sync" | "async"} RecryptMode */

/**
 * @typedef {object} BenchmarkOptions
 * @property {string} [input] PDF to recrypt; generated when left out.
 * @property {number} [requests] Recrypt requests per mode.
 * @property {number} [concurrency] Recrypt requests in flight at once.
 * @property {number} [pingInterval] Milliseconds between the end of one ping
 *   and the start of the next.
 * @property {number} [copies] How often the generated input repeats the
 *   fixture's pages; larger inputs take longer to recrypt.
 * @property {RecryptMode[]} [modes] Modes to measure, in order.
 */

/**
 * @typedef {object} Distribution
 * @property {number} count Number of samples.
 * @property {number} p50 Median in milliseconds.
 * @property {number} p95 95th percentile in milliseconds.
 * @property {number} p99 99th percentile in milliseconds.
 * @property {number} max Largest sample in milliseconds.
 */

/**
 * @typedef {object} LoopStats
 * @property {number} delayMean Mean event loop delay in milliseconds.
 * @property {number} delayP99 99th percentile event loop delay in milliseconds.
 * @property {number} delayMax Longest event loop stall in milliseconds.
 * @property {number} utilization Share of the time the event loop was busy,
 *   from 0 to 1.
 */

/**
 * @typedef {object} ModeResult
 * @property {RecryptMode} mode The measured mode.
 * @property {number} wallMs Time for all recrypt requests of this mode.
 * @property {number} throughput Recrypt requests per second.
 * @property {Distribution} recrypt Recrypt request latency seen by clients.
 * @property {Distribution} ping Ping latency seen by clients.
 * @property {LoopStats} loop The server's event loop during the run.
 */

/**
 * @typedef {object} BenchmarkResult
 * @property {string} input The recrypted PDF.
 * @property {number} inputBytes Its size in bytes.
 * @property {number} requests Recrypt requests per mode.
 * @property {number} concurrency Recrypt requests in flight at once.
 * @property {number} threadpoolSize libuv thread pool size of the server.
 * @property {string} node Node.js version.
 * @property {string} platform Platform and architecture.
 * @property {ModeResult[]} results One entry per mode.
 */

var RECRYPT_OPTIONS = {
  userPassword: "user",
  ownerPassword: "owner",
  userProtectionFlag: 4,
};

/**
 * @param {number[]} samples Milliseconds.
 * @returns {Distribution}
 */
function distribution(samples) {
  var sorted = samples.slice().sort(function (a, b) {
    return a - b;
  });
  /** @param {number} q */
  function at(q) {
    if (sorted.length === 0) return 0;
    return sorted[
      Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)
    ];
  }
  return {
    count: sorted.length,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    max: sorted.length ? sorted[sorted.length - 1] : 0,
  };
}

/**
 * Writes a PDF that repeats the pages of a test fixture.
 * @param {string} target Output path.
 * @param {number} copies How often to append the fixture.
 * @returns {void}
 */
function generateInput(target, copies) {
  var muhammara = require("..");
  var fixture = path.join(
    __dirname,
    "../tests/TestMaterials/BasicTIFFImagesTest.PDF",
  );
  var writer = muhammara.createWriter(target);
  for (var i = 0; i < copies; i++) writer.appendPDFPagesFromPDF(fixture);
  writer.end();
}

// ---------------------------------------------------------------------------
// Server (child process)

/**
 * @param {string} input PDF to recrypt.
 * @param {string} outputDirectory Directory for the recrypted files.
 * @returns {void}
 */
function serve(input, outputDirectory) {
  var muhammara = require("..");
  var delay = perfHooks.monitorEventLoopDelay({ resolution: 1 });
  var utilization = perfHooks.performance.eventLoopUtilization();
  var counter = 0;
  delay.enable();

  /**
   * @param {http.ServerResponse} response
   * @param {number} status
   * @param {unknown} body
   */
  function reply(response, status, body) {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  }

  var server = http.createServer(function (request, response) {
    var url = new URL(request.url || "/", "http://localhost");
    if (url.pathname === "/ping") {
      response.end("pong");
      return;
    }
    if (url.pathname === "/stats") {
      var current = perfHooks.performance.eventLoopUtilization(utilization);
      /** @type {LoopStats} */
      var stats = {
        delayMean: delay.mean / 1e6,
        delayP99: delay.percentile(99) / 1e6,
        delayMax: delay.max / 1e6,
        utilization: current.utilization,
      };
      delay.reset();
      utilization = perfHooks.performance.eventLoopUtilization();
      reply(response, 200, stats);
      return;
    }
    if (url.pathname === "/recrypt") {
      var mode = url.searchParams.get("mode");
      var target = path.join(outputDirectory, "out-" + counter++ + ".pdf");
      /** @param {unknown} error */
      var fail = function (error) {
        reply(response, 500, { error: String(error) });
      };
      var done = function () {
        fs.rm(target, { force: true }, function () {
          reply(response, 200, { ok: true });
        });
      };
      if (mode === "sync") {
        try {
          muhammara.recrypt(input, target, RECRYPT_OPTIONS);
        } catch (error) {
          fail(error);
          return;
        }
        done();
      } else if (mode === "async") {
        muhammara.recryptAsync(input, target, RECRYPT_OPTIONS).then(done, fail);
      } else {
        reply(response, 400, { error: "mode must be sync or async" });
      }
      return;
    }
    reply(response, 404, { error: "not found" });
  });

  server.listen(0, "127.0.0.1", function () {
    var address = server.address();
    if (process.send && address && typeof address === "object")
      process.send({ port: address.port });
  });
  process.on("disconnect", function () {
    server.close();
    process.exit(0);
  });
}

// ---------------------------------------------------------------------------
// Driver

/**
 * @param {http.Agent} agent
 * @param {number} port
 * @param {string} route
 * @returns {Promise<{ms: number, body: string}>}
 */
function get(agent, port, route) {
  return new Promise(function (resolve, reject) {
    var start = perfHooks.performance.now();
    var request = http.get(
      { host: "127.0.0.1", port: port, path: route, agent: agent },
      function (response) {
        var chunks = /** @type {Buffer[]} */ ([]);
        response.on("data", function (chunk) {
          chunks.push(chunk);
        });
        response.on("end", function () {
          var body = Buffer.concat(chunks).toString();
          if (response.statusCode !== 200) {
            reject(new Error(route + " failed: " + body));
            return;
          }
          resolve({ ms: perfHooks.performance.now() - start, body: body });
        });
      },
    );
    request.on("error", reject);
  });
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

/**
 * @param {number} port
 * @param {RecryptMode} mode
 * @param {Required<Omit<BenchmarkOptions, "input" | "modes" | "copies">>} options
 * @returns {Promise<ModeResult>}
 */
async function measureMode(port, mode, options) {
  var agent = new http.Agent({ keepAlive: true, maxSockets: Infinity });
  try {
    await get(agent, port, "/recrypt?mode=" + mode); // warm up
    await get(agent, port, "/stats"); // reset the server's counters

    var pings = /** @type {number[]} */ ([]);
    var running = true;
    var pinger = (async function () {
      while (running) {
        pings.push((await get(agent, port, "/ping")).ms);
        await sleep(options.pingInterval);
      }
    })();

    var recrypts = /** @type {number[]} */ ([]);
    var next = 0;
    var start = perfHooks.performance.now();
    var wallMs = 0;
    try {
      await Promise.all(
        Array.from({ length: options.concurrency }, async function () {
          while (next < options.requests) {
            next += 1;
            recrypts.push((await get(agent, port, "/recrypt?mode=" + mode)).ms);
          }
        }),
      );
      wallMs = perfHooks.performance.now() - start;
    } finally {
      // Stop the pinger even when a recrypt failed, so the recrypt error is
      // the one reported.
      running = false;
      await pinger.catch(function () {});
    }

    /** @type {LoopStats} */
    var loop = JSON.parse((await get(agent, port, "/stats")).body);
    return {
      mode: mode,
      wallMs: wallMs,
      throughput: (options.requests / wallMs) * 1000,
      recrypt: distribution(recrypts),
      ping: distribution(pings),
      loop: loop,
    };
  } finally {
    agent.destroy();
  }
}

/**
 * Runs the benchmark and returns the measurements.
 * @param {BenchmarkOptions} [options]
 * @returns {Promise<BenchmarkResult>}
 */
async function runBenchmark(options) {
  var settings = {
    requests: 16,
    concurrency: 4,
    pingInterval: 10,
    copies: 2,
    ...options,
  };
  var modes =
    settings.modes || /** @type {RecryptMode[]} */ (["sync", "async"]);
  var directory = fs.mkdtempSync(path.join(os.tmpdir(), "recrypt-bench-"));
  var input = settings.input;
  if (!input) {
    input = path.join(directory, "input.pdf");
    generateInput(input, settings.copies);
  }

  var child = childProcess.fork(__filename, ["--serve", input, directory], {
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  try {
    /** @type {number} */
    var port = await new Promise(function (resolve, reject) {
      child.once("message", function (message) {
        resolve(/** @type {{port: number}} */ (message).port);
      });
      child.once("error", reject);
      child.once("exit", function (code) {
        reject(new Error("benchmark server exited with " + code));
      });
    });
    var results = [];
    for (var mode of modes)
      results.push(
        await measureMode(port, mode, {
          requests: settings.requests,
          concurrency: settings.concurrency,
          pingInterval: settings.pingInterval,
        }),
      );
    return {
      input: settings.input || "generated (" + settings.copies + " copies)",
      inputBytes: fs.statSync(input).size,
      requests: settings.requests,
      concurrency: settings.concurrency,
      threadpoolSize: Number(process.env.UV_THREADPOOL_SIZE || 4),
      node: process.version,
      platform: process.platform + "-" + process.arch,
      results: results,
    };
  } finally {
    child.disconnect();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * @param {BenchmarkResult} result
 * @returns {string}
 */
function formatTable(result) {
  /** @param {number} value */
  var ms = function (value) {
    return value.toFixed(1);
  };
  var rows = [
    ["", ...result.results.map((r) => r.mode)],
    ["wall time (ms)", ...result.results.map((r) => ms(r.wallMs))],
    [
      "recrypts per second",
      ...result.results.map((r) => r.throughput.toFixed(1)),
    ],
    ["recrypt p50 (ms)", ...result.results.map((r) => ms(r.recrypt.p50))],
    ["recrypt p95 (ms)", ...result.results.map((r) => ms(r.recrypt.p95))],
    ["pings answered", ...result.results.map((r) => String(r.ping.count))],
    ["ping p50 (ms)", ...result.results.map((r) => ms(r.ping.p50))],
    ["ping p99 (ms)", ...result.results.map((r) => ms(r.ping.p99))],
    ["ping max (ms)", ...result.results.map((r) => ms(r.ping.max))],
    [
      "loop delay mean (ms)",
      ...result.results.map((r) => ms(r.loop.delayMean)),
    ],
    ["loop delay p99 (ms)", ...result.results.map((r) => ms(r.loop.delayP99))],
    ["loop delay max (ms)", ...result.results.map((r) => ms(r.loop.delayMax))],
    [
      "loop utilization",
      ...result.results.map((r) => (r.loop.utilization * 100).toFixed(0) + "%"),
    ],
  ];
  var widths = rows[0].map(function (_, column) {
    return Math.max.apply(
      null,
      rows.map(function (row) {
        return row[column].length;
      }),
    );
  });
  var lines = rows.map(function (row) {
    return row
      .map(function (cell, column) {
        return column === 0
          ? cell.padEnd(widths[column])
          : cell.padStart(widths[column]);
      })
      .join("  ");
  });
  return [
    "input: " +
      result.input +
      ", " +
      (result.inputBytes / 1024 / 1024).toFixed(1) +
      " MB",
    result.requests +
      " requests per mode, " +
      result.concurrency +
      " concurrent, UV_THREADPOOL_SIZE=" +
      result.threadpoolSize +
      ", Node.js " +
      result.node +
      " on " +
      result.platform,
    "",
    ...lines,
  ].join("\n");
}

/**
 * @param {string[]} argv
 * @returns {BenchmarkOptions & {json: boolean}}
 */
function parseArguments(argv) {
  /** @type {BenchmarkOptions & {json: boolean}} */
  var options = { json: false };
  for (var i = 0; i < argv.length; i++) {
    var name = argv[i];
    var value = argv[i + 1];
    if (name === "--json") options.json = true;
    else if (name === "--input") ((options.input = value), i++);
    else if (name === "--requests") ((options.requests = Number(value)), i++);
    else if (name === "--concurrency")
      ((options.concurrency = Number(value)), i++);
    else if (name === "--ping-interval")
      ((options.pingInterval = Number(value)), i++);
    else if (name === "--copies") ((options.copies = Number(value)), i++);
    else throw new Error("Unknown argument " + name);
  }
  return options;
}

if (require.main === module) {
  if (process.argv[2] === "--serve") {
    serve(process.argv[3], process.argv[4]);
  } else {
    var options = parseArguments(process.argv.slice(2));
    runBenchmark(options).then(
      function (result) {
        console.log(
          options.json ? JSON.stringify(result, null, 2) : formatTable(result),
        );
      },
      function (error) {
        console.error(error);
        process.exitCode = 1;
      },
    );
  }
}

module.exports = { runBenchmark, formatTable };
