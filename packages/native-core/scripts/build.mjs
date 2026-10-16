// Bundles native-core and the private @muhammara/shared sources it imports
// into one CommonJS file, so the published package never depends on
// @muhammara/shared. Runtime dependencies stay external.
import { build } from "esbuild";
import { readFileSync } from "node:fs";

var packageRoot = new URL("../", import.meta.url);
var manifest = JSON.parse(readFileSync(new URL("package.json", packageRoot)));

await build({
  absWorkingDir: new URL(".", packageRoot).pathname,
  entryPoints: ["index.js"],
  outfile: "dist/index.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: Object.keys(manifest.dependencies || {}),
  keepNames: true,
  sourcemap: "linked",
  logLevel: "warning",
});
