import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
  await cp(path.join(packageRoot, "examples", "browser"), targetRoot, {
    recursive: true,
  });
  await cp(
    path.join(packageRoot, "index.js"),
    path.join(targetRoot, "index.js"),
  );
  for (var directory of ["dist", "fonts", "lib"]) {
    await cp(
      path.join(packageRoot, directory),
      path.join(targetRoot, directory),
      { recursive: true },
    );
  }
  var moduleOptionsPath = path.join(targetRoot, "module-options.mjs");
  var moduleOptions = await readFile(moduleOptionsPath, "utf8");
  await writeFile(
    moduleOptionsPath,
    moduleOptions
      .replace('from "../../index.js"', 'from "./index.js"')
      .replace('"../../dist/', '"./dist/'),
  );
  await rm(path.join(targetRoot, "README.md"));
  await rm(path.join(targetRoot, "fonts", "README.md"));
}

await stagePagesExample();
