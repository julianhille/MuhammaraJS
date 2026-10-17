// Converts the private @muhammara/shared sources into CommonJS under
// lib/shared/, file by file, so the published package carries them without
// depending on @muhammara/shared, and its lib/ files keep working when
// required directly. lib/shared/ is generated and git-ignored.
import { build } from "esbuild";
import { readdirSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

var packageRoot = fileURLToPath(new URL("../", import.meta.url));
var sharedRoot = path.join(packageRoot, "../shared/lib");
var output = path.join(packageRoot, "lib/shared");

/**
 * Every JavaScript file below a directory.
 * @param {string} directory - The directory.
 * @returns {string[]} The file paths.
 */
function sources(directory) {
  return readdirSync(directory).flatMap((name) => {
    var file = path.join(directory, name);
    if (statSync(file).isDirectory()) return sources(file);
    return name.endsWith(".js") ? [file] : [];
  });
}

rmSync(output, { recursive: true, force: true });
await build({
  entryPoints: sources(sharedRoot),
  outbase: sharedRoot,
  outdir: output,
  bundle: false,
  platform: "node",
  format: "cjs",
  target: "node20",
  // Classes keep their names, such as Recipe.
  keepNames: true,
  logLevel: "warning",
});
