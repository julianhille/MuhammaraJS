import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

var root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
var realRoot = await realpath(root);

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

var server;
var browser;
try {
  server = await startServer();
  if (!process.env.CHROME_BIN) {
    throw new Error("CHROME_BIN is required for browser validation");
  }
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN,
    headless: true,
  });
  var page = await browser.newPage();
  await page.goto(
    `http://127.0.0.1:${server.port}/packages/wasm/tests/browser/index.html`,
    { waitUntil: "load" },
  );
  var timeout = setTimeout(
    () => server.rejectResult(new Error("browser validation timed out")),
    60000,
  );
  var result = await server.result;
  clearTimeout(timeout);
  if (!result.passed)
    throw new Error(result.error || "browser validation failed");
  await page.goto(
    `http://127.0.0.1:${server.port}/packages/wasm/examples/browser/index.html`,
    { waitUntil: "load" },
  );
  result.ui = await page.evaluate(async () => {
    var delay = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds));
    var tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    if (tabs.length !== 7) throw new Error("Expected seven example tabs");
    var annotations = document.querySelector('[data-example="annotations"]');
    for (var attempt = 0; attempt < 50; ++attempt) {
      annotations.click();
      if (annotations.getAttribute("aria-selected") === "true") break;
      await delay(50);
    }
    if (annotations.getAttribute("aria-selected") !== "true")
      throw new Error("Annotations tab did not activate");
    if (!document.querySelector(".file-grid").hidden)
      throw new Error("Annotation tab should not require assets");
    document.querySelector('input[name="mode"][value="page"]').click();
    document.querySelector("#example-form").requestSubmit();
    for (var run = 0; run < 200; ++run) {
      var status = document.querySelector("#status").textContent;
      if (status.startsWith("Complete.")) break;
      if (/Error|failed/i.test(status)) throw new Error(status);
      await delay(50);
    }
    var preview = document.querySelector("#preview");
    var download = document.querySelector("#download");
    if (!document.querySelector("#status").textContent.startsWith("Complete."))
      throw new Error("Annotation example timed out");
    if (!preview.src.startsWith("blob:"))
      throw new Error("PDF preview did not receive a blob URL");
    if (download.hidden || !download.href.startsWith("blob:"))
      throw new Error("PDF download was not shown");
    return { tabs: tabs.length, selected: "annotations", preview: true };
  });
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(`wasm browser validation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
}
