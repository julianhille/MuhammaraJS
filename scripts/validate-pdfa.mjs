// Validates the PDF/A samples that the native and Wasm PDF/A tests write
// (tests/output/PDFA-<level>[-<case>].pdf) with veraPDF. Tests cannot run
// veraPDF themselves: they run in-process, and veraPDF is a Java program.
//
// Uses `verapdf` from PATH, or the command in VERAPDF, and otherwise the
// verapdf/cli Docker image.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";

var root = fileURLToPath(new URL("..", import.meta.url));
var ends = [
  {
    name: "native",
    output: fileURLToPath(
      new URL("../packages/native-with-source/tests/output/", import.meta.url),
    ),
    test: ["npx", ["mocha", "packages/native-with-source/tests/PDFA.js"], root],
  },
  {
    name: "wasm",
    output: fileURLToPath(
      new URL("../packages/wasm/tests/output/", import.meta.url),
    ),
    test: [
      "node",
      ["./scripts/run-mocha.mjs", "tests/integration/PDFA.test.mjs"],
      fileURLToPath(new URL("../packages/wasm/", import.meta.url)),
    ],
  },
];
var SAMPLE = /^PDFA-([0-9][A-Z]?)(?:-[\w-]+)?\.pdf$/;

/**
 * Runs a command and stops this script when it fails.
 * @param {string} command - The program.
 * @param {string[]} args - Its arguments.
 * @param {string} cwd - The directory to run it in.
 * @returns {string} Its standard output.
 */
function run(command, args, cwd) {
  var result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0 && !/^(PASS|FAIL) /m.test(result.stdout)) {
    process.stderr.write(result.stdout + result.stderr);
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result.stdout;
}

/**
 * Lists the PDF/A samples an end wrote.
 * @param {string} output - Its tests/output directory.
 * @returns {string[]} The file names.
 */
function samples(output) {
  if (!existsSync(output)) return [];
  return readdirSync(output)
    .filter((file) => SAMPLE.test(file))
    .sort();
}

/**
 * Validates files against one flavour.
 * @param {string} flavour - The veraPDF flavour, such as 1b or 4f.
 * @param {string[]} files - Absolute paths under the repository.
 * @returns {Map<string, boolean>} Whether each file conforms, by path
 *   relative to the repository.
 */
function validate(flavour, files) {
  var paths = files.map((file) => relative(root, file));
  var local = process.env.VERAPDF || "verapdf";
  var hasLocal = !spawnSync(local, ["--version"]).error;
  var output = hasLocal
    ? run(local, ["--flavour", flavour, "--format", "text", ...paths], root)
    : run(
        "docker",
        [
          "run",
          "--rm",
          "-v",
          `${root}:/data`,
          "-w",
          "/data",
          "verapdf/cli",
          "--flavour",
          flavour,
          "--format",
          "text",
          ...paths,
        ],
        root,
      );
  var results = new Map();
  output.split("\n").forEach((line) => {
    var match = /^(PASS|FAIL) (\S+)/.exec(line);
    if (match) {
      results.set(
        relative(root, match[2].replace(/^\/data\//, root)),
        match[1] === "PASS",
      );
    }
  });
  return results;
}

var failed = false;
ends.forEach(({ output, test: [command, args, cwd] }) => {
  samples(output).forEach((file) => rmSync(output + file));
  run(command, args, cwd);
});

var [native, wasm] = ends.map(({ output }) => samples(output));
if (native.join() !== wasm.join()) {
  console.error("native and Wasm wrote different samples:", native, wasm);
  failed = true;
}

var byFlavour = new Map();
ends.forEach(({ output }) =>
  samples(output).forEach((file) => {
    var flavour = SAMPLE.exec(file)[1].toLowerCase();
    byFlavour.set(flavour, [...(byFlavour.get(flavour) || []), output + file]);
  }),
);
byFlavour.forEach((files, flavour) => {
  var results = validate(flavour, files);
  files.forEach((file) => {
    var path = relative(root, file);
    var passed = results.get(path);
    console.log(`${passed ? "PASS" : "FAIL"} ${flavour} ${path}`);
    if (!passed) failed = true;
  });
});
process.exitCode = failed ? 1 : 0;
