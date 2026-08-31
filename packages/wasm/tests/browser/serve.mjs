import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

var root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
var port = Number(process.env.PORT || 8080);
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

var server = createServer(async (request, response) => {
  if (request.url === "/") {
    response
      .writeHead(302, {
        location: "/packages/wasm/examples/browser/index.html",
      })
      .end();
    return;
  }
  if (request.method === "POST" && request.url === "/__wasm_browser_result__") {
    response.writeHead(204).end();
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return;
  }
  try {
    var pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    var filename = path.resolve(root, `.${pathname}`);
    if (!filename.startsWith(`${root}${path.sep}`))
      throw new Error("outside root");
    filename = await realpath(filename);
    if (!filename.startsWith(`${realRoot}${path.sep}`))
      throw new Error("outside real root");
    if (!(await stat(filename)).isFile()) throw new Error("not a file");
    response.writeHead(200, { "content-type": contentType(filename) });
    if (request.method === "HEAD") response.end();
    else response.end(await readFile(filename));
  } catch {
    response.writeHead(404).end();
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    `Open http://127.0.0.1:${port}/ to run the interactive browser example`,
  );
});
