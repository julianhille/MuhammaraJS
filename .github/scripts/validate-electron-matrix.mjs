import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

var workflow = readFileSync(
  new URL("../workflows/ci-native.yml", import.meta.url),
  "utf8",
);
var jobNames = [
  "build-electron-legacy",
  "build-electron-38-39",
  "build-electron-40-41",
  "build-electron",
];
var expectedVersions = new Map([
  ["36.0.0", "22.14.0"],
  ["36.1.0", "22.14.0"],
  ["36.2.0", "22.15.0"],
  ["36.3.0", "22.15.1"],
  ["36.4.0", "22.15.1"],
  ["36.5.0", "22.16.0"],
  ["36.6.0", "22.16.0"],
  ["36.7.0", "22.17.0"],
  ["36.8.0", "22.18.0"],
  ["36.9.0", "22.19.0"],
  ["37.0.0", "22.16.0"],
  ["37.1.0", "22.16.0"],
  ["37.2.0", "22.17.0"],
  ["37.3.0", "22.18.0"],
  ["37.4.0", "22.18.0"],
  ["37.5.0", "22.19.0"],
  ["38.0.0", "22.18.0"],
  ["38.1.0", "22.19.0"],
  ["38.2.2", "22.19.0"],
  ["38.3.0", "22.20.0"],
  ["38.4.0", "22.20.0"],
  ["38.5.0", "22.20.0"],
  ["38.6.0", "22.21.1"],
  ["38.7.2", "22.21.1"],
  ["38.8.6", "22.22.0"],
  ["39.0.0", "22.20.0"],
  ["39.1.2", "22.21.1"],
  ["39.2.7", "22.21.1"],
  ["39.3.0", "22.21.1"],
  ["39.4.0", "22.22.0"],
  ["39.5.2", "22.22.0"],
  ["39.6.1", "22.22.0"],
  ["39.7.0", "22.22.0"],
  ["39.8.10", "22.22.1"],
  ["40.0.0", "24.11.1"],
  ["40.1.0", "24.11.1"],
  ["40.2.1", "24.11.1"],
  ["40.3.0", "24.13.0"],
  ["40.4.1", "24.13.0"],
  ["40.5.0", "24.13.1"],
  ["40.6.1", "24.13.1"],
  ["40.7.0", "24.14.0"],
  ["40.8.5", "24.14.0"],
  ["40.9.3", "24.14.1"],
  ["40.10.6", "24.15.0"],
  ["41.0.4", "24.14.0"],
  ["41.1.1", "24.14.0"],
  ["41.2.2", "24.14.1"],
  ["41.3.0", "24.15.0"],
  ["41.4.0", "24.15.0"],
  ["41.5.2", "24.15.0"],
  ["41.6.1", "24.15.0"],
  ["41.7.2", "24.15.0"],
  ["41.8.0", "24.16.0"],
  ["41.9.2", "24.17.0"],
  ["41.10.7", "24.18.0"],
  ["42.0.1", "24.15.0"],
  ["42.1.0", "24.15.0"],
  ["42.2.0", "24.15.0"],
  ["42.3.3", "24.15.0"],
  ["42.4.1", "24.16.0"],
  ["42.5.2", "24.17.0"],
  ["42.6.2", "24.18.0"],
  ["42.7.1", "24.18.0"],
  ["42.8.1", "24.18.1"],
  ["42.9.3", "24.18.1"],
  ["42.10.1", "24.18.1"],
  ["43.0.0", "24.17.0"],
  ["43.1.1", "24.18.0"],
  ["43.2.0", "24.18.0"],
  ["43.3.0", "24.18.1"],
  ["43.4.1", "24.18.1"],
  ["44.0.0", "24.18.1"],
]);
var versions = [];
var nodeVersions = new Map();

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

for (var jobName of jobNames) {
  var job = getJob(jobName);
  var matrixMatch = job.match(
    /        electron:\n((?:          - \d+\.\d+\.\d+\n)+)        include:/,
  );
  assert.ok(matrixMatch, `Missing Electron matrix in ${jobName}`);

  var matrixVersions = Array.from(
    matrixMatch[1].matchAll(/          - (\d+\.\d+\.\d+)/g),
    (match) => match[1],
  );
  var mappedVersions = Array.from(
    job.matchAll(
      /          - electron: (\d+\.\d+\.\d+)\n            node: (\d+\.\d+\.\d+)/g,
    ),
  );

  assert.deepEqual(
    mappedVersions.map((match) => match[1]).sort(),
    matrixVersions.sort(),
    `${jobName} must map every Electron version to exactly one Node version`,
  );
  for (var mapping of mappedVersions) {
    nodeVersions.set(mapping[1], mapping[2]);
  }
  versions.push(...matrixVersions);
}

assert.deepEqual(
  versions.toSorted(),
  Array.from(expectedVersions.keys()).sort(),
  "Electron matrix must contain the validated newest patch for every supported minor",
);
assert.deepEqual(
  nodeVersions,
  expectedVersions,
  "Electron versions must use their validated Node runtime",
);

var minors = new Map();
for (var version of versions) {
  var minor = version.split(".").slice(0, 2).join(".");
  assert.ok(
    !minors.has(minor),
    `Electron ${minor} has multiple patch builds: ${minors.get(minor)} and ${version}`,
  );
  minors.set(minor, version);
}

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

assert.equal(
  nativePackage.binary.package_name,
  sourcePackage.binary.package_name,
  "Native packages must use the same prebuild filename",
);
assert.ok(
  nativePackage.binary.package_name.includes("{node_abi}"),
  "Electron prebuild filenames must preserve the major.minor ABI label",
);

console.log(
  `Validated ${versions.length} Electron builds with one patch per minor.`,
);
