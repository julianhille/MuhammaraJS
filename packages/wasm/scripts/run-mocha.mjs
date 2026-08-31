import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

var packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
var repositoryRoot = path.resolve(packageRoot, "../..");
var testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "muhammara-wasm-tests-"));
var testCwd = path.join(testRoot, "native");
var materials = path.join(
  repositoryRoot,
  "packages/native/tests/TestMaterials",
);
fs.mkdirSync(path.join(testCwd, "tests"), { recursive: true });
fs.symlinkSync(
  materials,
  path.join(testCwd, "tests/TestMaterials"),
  "junction",
);
fs.symlinkSync(packageRoot, path.join(testRoot, "wasm"), "junction");

var mocha = fileURLToPath(import.meta.resolve("mocha/bin/mocha.js"));
var result = spawnSync(
  process.execPath,
  [
    mocha,
    "-R",
    "tap",
    ...process.argv.slice(2).map(function (testPath) {
      return path.resolve(packageRoot, testPath);
    }),
    "--timeout",
    "15000",
  ],
  { cwd: testCwd, stdio: "inherit" },
);
fs.rmSync(testRoot, { force: true, recursive: true });

if (result.error) throw result.error;
process.exitCode = result.status === null ? 1 : result.status;
