// Bundles the Wasm package's JavaScript and the private @muhammara/shared
// sources it imports into dist/, next to the Emscripten output, so the
// published package never depends on @muhammara/shared.
//
// - dist/index.js is the package entry; dist/recrypt-worker.js is the worker
//   that lib/recrypt-worker-client.js starts with
//   `new URL("./recrypt-worker.js", import.meta.url)`, which resolves next to
//   the bundle exactly as it did next to the source.
// - The bundled Roboto font stays a separate chunk, loaded only when used.
// - The Emscripten glue stays a separate file: it finds muhammara-wasm.wasm
//   through its own import.meta.url.
import { build } from "esbuild";
import { readdirSync, readFileSync, rmSync } from "node:fs";

var packageRoot = new URL("../", import.meta.url);
var manifest = JSON.parse(readFileSync(new URL("package.json", packageRoot)));

/** Keeps the Emscripten glue external and points imports at its dist/ path. */
var emscriptenGlue = {
  name: "emscripten-glue",
  setup(build) {
    build.onResolve({ filter: /(^|\/)muhammara-wasm\.js$/ }, function () {
      return { path: "./muhammara-wasm.js", external: true };
    });
  },
};

// Remove the previous bundle, whose hashed chunk names change between builds,
// and keep the Emscripten output.
var dist = new URL("dist/", packageRoot);
for (var file of readdirSync(dist)) {
  if (
    /^(index|recrypt-worker|chunk-.+|Roboto-Regular-.+)\.js(\.map)?$/.test(file)
  )
    rmSync(new URL(file, dist));
}

await build({
  absWorkingDir: new URL(".", packageRoot).pathname,
  entryPoints: { index: "index.js", "recrypt-worker": "lib/recrypt-worker.js" },
  outdir: "dist",
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "neutral",
  // Bundled dependencies such as linebreak and @xmldom/xmldom: prefer their
  // browser builds.
  mainFields: ["browser", "module", "main"],
  conditions: ["browser", "import", "default"],
  target: "es2022",
  // Chunks sit next to the entries, so their relative URLs resolve alike.
  chunkNames: "[name]-[hash]",
  external: [...Object.keys(manifest.dependencies || {}), "node:*"],
  plugins: [emscriptenGlue],
  keepNames: true,
  sourcemap: "linked",
  logLevel: "warning",
});
