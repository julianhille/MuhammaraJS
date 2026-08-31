import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

var root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
var realRoot = await realpath(root);
var firefoxBin = process.env.FIREFOX_BIN || "/usr/bin/firefox";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function availablePort() {
  return new Promise((resolve, reject) => {
    var server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      var port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function websocketFrame(text) {
  var payload = Buffer.from(text);
  var mask = randomBytes(4);
  var header;
  if (payload.length < 126) header = Buffer.from([0x81, 0x80 | payload.length]);
  else if (payload.length < 65536) {
    header = Buffer.from([
      0x81,
      0xfe,
      payload.length >> 8,
      payload.length & 0xff,
    ]);
  } else {
    throw new Error("WebDriver BiDi command is unexpectedly large");
  }
  for (var index = 0; index < payload.length; ++index)
    payload[index] ^= mask[index % 4];
  return Buffer.concat([header, mask, payload]);
}

class BidiConnection {
  static connect(port) {
    return new Promise((resolve, reject) => {
      var socket = net.connect(port, "127.0.0.1");
      var connection = new BidiConnection(socket);
      var settled = false;
      var fail = (error) => {
        if (!settled) {
          settled = true;
          socket.destroy();
          reject(error);
        }
      };
      socket.once("error", fail);
      socket.once("connect", () => {
        var key = randomBytes(16).toString("base64");
        connection.expectedAccept = createHash("sha1")
          .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
          .digest("base64");
        socket.write(
          `GET /session HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
        );
      });
      connection.onReady = () => {
        if (!settled) {
          settled = true;
          socket.off("error", fail);
          resolve(connection);
        }
      };
      connection.onFailure = fail;
    });
  }

  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.handshake = true;
    this.nextId = 0;
    this.pending = new Map();
    socket.on("data", (chunk) => this.receive(chunk));
    socket.on("error", (error) => this.fail(error));
    socket.on("close", () =>
      this.fail(new Error("WebDriver BiDi connection closed")),
    );
  }

  receive(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.handshake) {
      var end = this.buffer.indexOf("\r\n\r\n");
      if (end === -1) return;
      var header = this.buffer.subarray(0, end).toString();
      this.buffer = this.buffer.subarray(end + 4);
      if (!header.startsWith("HTTP/1.1 101")) {
        this.onFailure(new Error(`WebDriver BiDi handshake failed: ${header}`));
        return;
      }
      var accept = /sec-websocket-accept: ([^\r\n]+)/i.exec(header);
      if (!accept || accept[1].trim() !== this.expectedAccept) {
        this.onFailure(
          new Error("WebDriver BiDi handshake returned an invalid accept key"),
        );
        return;
      }
      this.handshake = false;
      this.onReady();
    }
    while (this.buffer.length >= 2) {
      var length = this.buffer[1] & 0x7f;
      var offset = 2;
      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        this.fail(new Error("Unexpectedly large WebDriver BiDi frame"));
        return;
      }
      if (this.buffer.length < offset + length) return;
      var opcode = this.buffer[0] & 0x0f;
      var payload = this.buffer.subarray(offset, offset + length);
      this.buffer = this.buffer.subarray(offset + length);
      if (opcode === 0x8) {
        this.socket.end();
        return;
      }
      if (opcode === 0x9) {
        this.socket.write(
          Buffer.concat([Buffer.from([0x8a, length]), payload]),
        );
      } else if (opcode === 0x1) {
        var message = JSON.parse(payload.toString());
        if (message.id) {
          var pending = this.pending.get(message.id);
          if (!pending) continue;
          this.pending.delete(message.id);
          if (message.type === "success") pending.resolve(message.result);
          else
            pending.reject(
              new Error(message.error || "WebDriver BiDi command failed"),
            );
        }
      }
    }
  }

  command(method, params) {
    var id = ++this.nextId;
    return new Promise((resolve, reject) => {
      var timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`WebDriver BiDi ${method} timed out`));
      }, 15000);
      this.pending.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      this.socket.write(websocketFrame(JSON.stringify({ id, method, params })));
    });
  }

  fail(error) {
    for (var pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  close() {
    this.socket.end();
  }
}

async function waitForBidi(port, browserError) {
  var lastError;
  for (var attempt = 0; attempt < 50; ++attempt) {
    if (browserError()) throw browserError();
    try {
      return await BidiConnection.connect(port);
    } catch (error) {
      lastError = error;
      await delay(100);
    }
  }
  throw new Error(`Firefox Remote Agent did not start: ${lastError.message}`);
}

function contentType(filename) {
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".mjs": "text/javascript; charset=utf-8",
      ".wasm": "application/wasm",
    }[path.extname(filename)] || "application/octet-stream"
  );
}

function startServer() {
  var resolveResult;
  var rejectResult;
  var resultPromise = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  var server = createServer(async (request, response) => {
    if (
      request.method === "POST" &&
      request.url === "/__wasm_browser_result__"
    ) {
      var body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
        if (body.length > 65536) request.destroy();
      });
      request.on("end", () => {
        try {
          var result = JSON.parse(body);
          response.writeHead(204).end();
          resolveResult(result);
        } catch (error) {
          response.writeHead(400).end();
          rejectResult(error);
        }
      });
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }
    var pathname;
    try {
      pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
    } catch {
      response.writeHead(400).end();
      return;
    }
    var filename = path.resolve(root, `.${pathname}`);
    if (!filename.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      filename = await realpath(filename);
      if (!filename.startsWith(`${realRoot}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }
      var info = await stat(filename);
      if (!info.isFile()) throw new Error("not a file");
      response.writeHead(200, { "content-type": contentType(filename) });
      if (request.method === "HEAD") response.end();
      else response.end(await readFile(filename));
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve({
        port: server.address().port,
        result: resultPromise,
        close: () => new Promise((done) => server.close(done)),
        rejectResult,
      });
    });
  });
}

async function stopBrowser(browser) {
  if (!browser || browser.exitCode !== null) return;
  browser.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => browser.once("exit", resolve)),
    delay(5000),
  ]);
  if (browser.exitCode === null) browser.kill("SIGKILL");
}

var server;
var browser;
var profile;
var bidi;
var browserStartError;
var browserErrors = "";
try {
  server = await startServer();
  profile = await mkdtemp(path.join(os.tmpdir(), "muhammara-firefox-"));
  var bidiPort = await availablePort();
  browser = spawn(
    firefoxBin,
    [
      "--headless",
      "--remote-debugging-port",
      String(bidiPort),
      "--profile",
      profile,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  browser.on("error", (error) => {
    browserStartError = error;
  });
  browser.stderr.on("data", (chunk) => {
    browserErrors += chunk;
  });
  bidi = await waitForBidi(bidiPort, () => browserStartError);
  await bidi.command("session.new", { capabilities: { alwaysMatch: {} } });
  var context = await bidi.command("browsingContext.create", { type: "tab" });
  await bidi.command("browsingContext.navigate", {
    context: context.context,
    url: `http://127.0.0.1:${server.port}/packages/wasm/tests/browser/index.html`,
    wait: "complete",
  });
  var timeout = setTimeout(
    () => server.rejectResult(new Error("browser validation timed out")),
    60000,
  );
  var result = await server.result;
  clearTimeout(timeout);
  if (!result.passed)
    throw new Error(result.error || "browser validation failed");
  await bidi.command("browsingContext.navigate", {
    context: context.context,
    url: `http://127.0.0.1:${server.port}/packages/wasm/examples/browser/index.html`,
    wait: "complete",
  });
  var uiEvaluation = await bidi.command("script.evaluate", {
    expression: `(async () => {
      var delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      var tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      if (tabs.length !== 7) throw new Error('Expected seven example tabs');
      var annotations = document.querySelector('[data-example="annotations"]');
      for (var attempt = 0; attempt < 50; ++attempt) {
        annotations.click();
        if (annotations.getAttribute('aria-selected') === 'true') break;
        await delay(50);
      }
      if (annotations.getAttribute('aria-selected') !== 'true') throw new Error('Annotations tab did not activate');
      if (!document.querySelector('.file-grid').hidden) throw new Error('Annotation tab should not require assets');
      document.querySelector('input[name="mode"][value="page"]').click();
      document.querySelector('#example-form').requestSubmit();
      for (var run = 0; run < 200; ++run) {
        var status = document.querySelector('#status').textContent;
        if (status.startsWith('Complete.')) break;
        if (/Error|failed/i.test(status)) throw new Error(status);
        await delay(50);
      }
      var preview = document.querySelector('#preview');
      var download = document.querySelector('#download');
      if (!document.querySelector('#status').textContent.startsWith('Complete.')) throw new Error('Annotation example timed out');
      if (!preview.src.startsWith('blob:')) throw new Error('PDF preview did not receive a blob URL');
      if (download.hidden || !download.href.startsWith('blob:')) throw new Error('PDF download was not shown');
      return JSON.stringify({ tabs: tabs.length, selected: 'annotations', preview: true });
    })()`,
    target: { context: context.context },
    awaitPromise: true,
    resultOwnership: "none",
  });
  if (uiEvaluation.type !== "success")
    throw new Error(
      uiEvaluation.exceptionDetails?.text || "browser example UI failed",
    );
  result.ui = JSON.parse(uiEvaluation.result.value);
  console.log(JSON.stringify(result));
} catch (error) {
  var firefoxOutput = browserErrors.trim();
  console.error(
    `wasm browser validation failed: ${error.message}${firefoxOutput ? `\nFirefox: ${firefoxOutput}` : ""}`,
  );
  process.exitCode = 1;
} finally {
  if (bidi) bidi.close();
  await stopBrowser(browser);
  if (server) await server.close();
  if (profile) await rm(profile, { recursive: true, force: true });
}
