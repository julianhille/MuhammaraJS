import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Stages the current checkout's browser example for the documentation. */
async function stageBrowserExample() {
  var packageRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  var targetRoot = path.join(packageRoot, "docs", "browser-example");
  await rm(targetRoot, { force: true, recursive: true });
  await mkdir(targetRoot, { recursive: true });
  await cp(
    path.join(packageRoot, "index.js"),
    path.join(targetRoot, "index.js"),
  );
  for (var directory of ["fonts", "lib", "examples/browser"]) {
    await cp(
      path.join(packageRoot, directory),
      path.join(targetRoot, directory),
      {
        recursive: true,
      },
    );
  }
  await rm(path.join(targetRoot, "examples", "browser", "README.md"));
  await rm(path.join(targetRoot, "fonts", "README.md"));

  var dist = path.join(packageRoot, "dist");
  if (existsSync(path.join(dist, "muhammara-wasm.wasm"))) {
    await cp(dist, path.join(targetRoot, "dist"), { recursive: true });
  } else if (process.env.REQUIRE_WASM_DIST === "1") {
    throw new Error("Build packages/wasm/dist before staging browser docs");
  }
}

await stageBrowserExample();
