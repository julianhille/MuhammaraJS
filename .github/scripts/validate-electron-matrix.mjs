import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

var workflow = readFileSync(
  new URL("../workflows/ci-native.yml", import.meta.url),
  "utf8",
);
var bindingGyp = readFileSync(
  new URL("../../packages/native-with-source/binding.gyp", import.meta.url),
  "utf8",
);
var expectedCases = [
  ["ubuntu-22.04", "linux", "x64", "36.0.0", "22.14.0"],
  ["ubuntu-22.04", "linux", "x64", "44.0.0", "24.18.1"],
  ["macos-15", "darwin", "x64", "36.0.0", "22.14.0"],
  ["macos-15", "darwin", "x64", "38.1.0", "22.19.0"],
  ["macos-15", "darwin", "arm64", "36.0.0", "22.14.0"],
  ["macos-15", "darwin", "arm64", "44.0.0", "24.18.1"],
  ["windows-2022", "win32", "x64", "36.0.0", "22.14.0"],
  ["windows-2022", "win32", "x64", "44.0.0", "24.18.1"],
];

/**
 * Return one top-level job from the native workflow.
 *
 * @param {string} name job name
 * @returns {string} job YAML
 */
function getJob(name) {
  var marker = `  ${name}:\n`;
  var start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `Missing ${name} job`);

  var remainder = workflow.slice(start + marker.length);
  var nextJob = remainder.search(/^  [a-zA-Z0-9_-]+:\n/m);
  return nextJob === -1 ? remainder : remainder.slice(0, nextJob);
}

var electronJob = getJob("test-electron");
var cases = Array.from(
  electronJob.matchAll(
    /          - os: (\S+)\n            platform: (\S+)\n            architecture: (\S+)\n            architecture_node: \S+\n            libc: \S+\n            electron: (\d+\.\d+\.\d+)\n            node: (\d+\.\d+\.\d+)/g,
  ),
  (match) => match.slice(1),
);
assert.deepEqual(
  cases,
  expectedCases,
  "Electron CI must test the supported Node-API compatibility boundaries",
);

var nativePackage = JSON.parse(
  readFileSync(
    new URL("../../packages/native/package.json", import.meta.url),
    "utf8",
  ),
);
var sourcePackage = JSON.parse(
  readFileSync(
    new URL("../../packages/native-with-source/package.json", import.meta.url),
    "utf8",
  ),
);
var workflowVersionMatch = workflow.match(/^  NAPI_VERSION: (\d+)$/m);
assert.ok(workflowVersionMatch, "Native CI must declare NAPI_VERSION");
var napiVersion = Number(workflowVersionMatch[1]);

assert.equal(
  nativePackage.binary.package_name,
  sourcePackage.binary.package_name,
  "Native packages must use the same prebuild filename",
);
assert.equal(
  nativePackage.binary.module_path,
  sourcePackage.binary.module_path,
  "Native packages must use the same installed binding path",
);
for (var packageManifest of [nativePackage, sourcePackage]) {
  assert.ok(
    packageManifest.binary.package_name.includes("{napi_build_version}"),
    `${packageManifest.name} must identify the Node-API build version`,
  );
  assert.ok(
    !packageManifest.binary.package_name.includes("{node_abi}"),
    `${packageManifest.name} must not identify a runtime-specific ABI`,
  );
  assert.deepEqual(
    packageManifest.binary.napi_versions,
    [napiVersion],
    `${packageManifest.name} must match the CI Node-API version`,
  );
  assert.ok(
    packageManifest.binary.module_path.includes("{napi_build_version}"),
    `${packageManifest.name} must version its installed binding path`,
  );
}
assert.match(
  bindingGyp,
  new RegExp(`'napi_build_version%': ${napiVersion}(?:,|\\s)`),
  "binding.gyp must match the CI Node-API version",
);
assert.ok(
  workflow.includes("prebuild-napi-v${{ env.NAPI_VERSION }}-"),
  "CI artifact names must identify the Node-API version",
);
assert.doesNotMatch(
  workflow,
  /^\s+name: prebuild-(?!napi-v)/m,
  "CI must not publish an unversioned prebuild artifact",
);

var muslBuild = getJob("build-prebuild-musl");
assert.match(
  muslBuild,
  /runner: ubuntu-22\.04\n\s+architecture: arm64\n\s+image: dockcross\/linux-arm64-musl/,
  "ARM64 musl must cross-build in Dockcross on an x64 runner",
);
assert.match(
  muslBuild,
  /if: matrix\.architecture == 'arm64'\n\s+run: npm run package --workspace=@muhammara\/native-with-source -- --target_arch=arm64 --target_libc=musl/,
  "Cross-built ARM64 addons must be packaged without host load-testing",
);
var muslTests = getJob("test-node-musl");
assert.doesNotMatch(
  muslTests,
  /ubuntu-22\.04-arm/,
  "Job-level Alpine containers cannot run JavaScript actions on ARM64",
);
var armMuslTests = getJob("test-node-musl-arm64");
assert.match(armMuslTests, /runs-on: ubuntu-22\.04-arm/);
assert.doesNotMatch(armMuslTests, /^    container:/m);
assert.match(armMuslTests, /node: \[20\.19\.0, 26\.8\.1\]/);
assert.match(armMuslTests, /docker exec musl-tests npm ci --ignore-scripts/);
assert.match(armMuslTests, /docker exec musl-tests npm test/);
assert.match(
  armMuslTests,
  /docker exec musl-tests node \.github\/scripts\/prepare-native-prebuild\.mjs verify/,
);
assert.match(
  getJob("publish"),
  /test-node-musl-arm64,/,
  "Publishing must wait for native ARM64 musl tests",
);

console.log(
  `Validated ${cases.length} Electron Node-API boundary checks and musl build/test separation.`,
);
