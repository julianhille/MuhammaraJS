# Benchmark Sync And Async Recrypt

`recrypt()` blocks the event loop while it re-encrypts a document.
`recryptAsync()` does the same work on libuv's thread pool. The benchmark in
[`packages/native-with-source/benchmarks/recrypt-server.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/benchmarks/recrypt-server.js)
shows what that means for a server.

It starts an HTTP server in a child process with two routes:

- `/recrypt?mode=sync` or `/recrypt?mode=async` re-encrypts a PDF with
  `userPassword`, `ownerPassword` and `userProtectionFlag: 4`.
- `/ping` answers at once, like any cheap request on a busy server.

The parent process sends recrypt requests at a fixed concurrency and pings the
server the whole time, so the client never shares the server's event loop.

## Run It

From a source checkout with a built addon:

```sh
cd packages/native-with-source
npm run bench:recrypt
npm run bench:recrypt -- --input large.pdf --requests 32 --concurrency 8
npm run bench:recrypt -- --json
```

| Option            | Default       | Meaning                                                           |
| ----------------- | ------------- | ----------------------------------------------------------------- |
| `--input`         | generated PDF | The PDF to recrypt.                                               |
| `--copies`        | `2`           | Copies of the test fixture in the generated PDF, about 8 MB each. |
| `--requests`      | `16`          | Recrypt requests per mode.                                        |
| `--concurrency`   | `4`           | Recrypt requests in flight at once.                               |
| `--ping-interval` | `10`          | Milliseconds between one ping's answer and the next ping.         |
| `--json`          | off           | Print the measurements as JSON instead of a table.                |

`runBenchmark(options)` and `formatTable(result)` are exported for scripts.
The file is type-checked against the package's declarations.

## Read The Results

| Row                 | Meaning                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| wall time           | Time for all recrypt requests of the mode.                                                            |
| recrypts per second | Recrypt throughput.                                                                                   |
| recrypt p50, p95    | How long a client waited for a recrypt response.                                                      |
| pings answered      | Pings the server answered during the run.                                                             |
| ping p50, p99, max  | How long a cheap request waited. This is the cost other clients pay.                                  |
| loop delay          | How late the server's event loop ran, from `monitorEventLoopDelay`. The maximum is the longest stall. |
| loop utilization    | Share of the run the server's event loop was busy, from `eventLoopUtilization`.                       |

## Example Results

A 15.9 MB generated PDF, 16 requests per mode with 4 in flight, on Linux x64
with 4 CPUs, Node.js 22.22 and the default `UV_THREADPOOL_SIZE` of 4:

|                     | `recrypt` | `recryptAsync` |
| ------------------- | --------: | -------------: |
| wall time           |    4.55 s |         4.68 s |
| recrypts per second |       3.5 |            3.4 |
| recrypt p50         |   1107 ms |        1165 ms |
| recrypt p95         |   1667 ms |        1228 ms |
| pings answered      |         9 |            425 |
| ping p50            |    520 ms |         0.6 ms |
| ping p99            |   1076 ms |         2.3 ms |
| loop delay max      |    751 ms |         6.5 ms |
| loop utilization    |      100% |             5% |

Throughput is the same, because `recryptAsync` runs one recrypt at a time just
as the synchronous server does. The difference is everything else. With
`recrypt` the server answered 9 pings in four and a half seconds, and a ping
waited up to a second. With `recryptAsync` pings were answered in under a
millisecond, and the event loop was idle 95% of the time.

The same run against a 95.6 MB PDF (`--copies 12`) took about 26 s per mode.
With `recrypt` the server answered 10 pings, and the event loop stalled for
up to 4.9 s; with `recryptAsync` it answered 2516 pings and never stalled for
more than 16 ms.

Times depend on the machine, the document and its encryption; run the
benchmark on your own documents to size a server.
