// Runs the package under jsdom, as test runners such as Jest set it up: the
// page's window, document, and location become globals while Node loads the
// binary from disk. Covers jsdom's about:blank and Jest's localhost base URL.
import { JSDOM } from "jsdom";
import { checkRuntime } from "./smoke.mjs";

var results = [];
for (var [index, url] of ["about:blank", "http://localhost/"].entries()) {
  var dom = new JSDOM("<!doctype html><html><body></body></html>", { url });
  var globals = {
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
  };
  var previous = {};
  for (var name of Object.keys(globals)) {
    previous[name] = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: globals[name],
    });
  }
  try {
    results.push(
      await checkRuntime(`${url}, default options`, {
        // Limits of their own, so each run starts a worker of its own.
        limits: { maxOutputBytes: 987654321 + index * 2 },
      }),
      await checkRuntime(`${url}, locateFile path`, {
        locateFile: (file, prefix) => prefix + file,
        limits: { maxOutputBytes: 987654322 + index * 2 },
      }),
    );
  } finally {
    for (var name of Object.keys(globals)) {
      if (previous[name])
        Object.defineProperty(globalThis, name, previous[name]);
      else delete globalThis[name];
    }
    dom.window.close();
  }
}
console.log(JSON.stringify(results));
