import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Stages the browser example and package runtime for GitHub Pages. */
async function stagePagesExample() {
  var packageRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  var targetRoot = path.join(packageRoot, "pages");
  await rm(targetRoot, { force: true, recursive: true });
  await mkdir(targetRoot, { recursive: true });
  await cp(
    path.join(packageRoot, "index.js"),
    path.join(targetRoot, "index.js"),
  );
  for (var directory of ["dist", "fonts", "lib", "examples/browser"]) {
    await cp(
      path.join(packageRoot, directory),
      path.join(targetRoot, directory),
      { recursive: true },
    );
  }
  await writeFile(path.join(targetRoot, ".nojekyll"), "");
}

await stagePagesExample();
