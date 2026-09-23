import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

var packageRoot = path.resolve(
  import.meta.dirname,
  "../../packages/native-with-source",
);
var packageManifest = JSON.parse(
  readFileSync(path.join(packageRoot, "package.json"), "utf8"),
);
var napiVersions = packageManifest.binary.napi_versions;
if (!Array.isArray(napiVersions) || napiVersions.length !== 1) {
  throw new Error("Expected exactly one canonical Node-API version");
}
var modulePath = path.join(packageRoot, "binding", `napi-v${napiVersions[0]}`);
var addonPath = path.join(modulePath, "muhammara.node");
var checksumPath = path.join(modulePath, ".canonical-sha256");

/**
 * Calculate the SHA-256 digest of the installed addon.
 *
 * @returns {string} addon digest
 */
function addonDigest() {
  return createHash("sha256").update(readFileSync(addonPath)).digest("hex");
}

/**
 * Find generated archives below a staging directory.
 *
 * @param {string} directory directory to search
 * @param {string} filename archive filename
 * @returns {Promise<string[]>} archive paths
 */
async function findArchives(directory, filename) {
  var matches = [];
  for (var entry of await readdir(directory, { withFileTypes: true })) {
    var entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findArchives(entryPath, filename)));
    } else if (entry.name === filename) {
      matches.push(entryPath);
    }
  }
  return matches;
}

if (process.argv[2] === "verify") {
  var expectedDigest = readFileSync(checksumPath, "utf8").trim();
  var actualDigest = addonDigest();
  if (actualDigest !== expectedDigest) {
    throw new Error("The canonical prebuild was replaced during test setup");
  }
  console.log(`Verified canonical prebuild ${actualDigest}`);
  process.exit(0);
}

if (process.argv[2] === "stage") {
  var sourceDirectory = path.resolve(process.argv[3]);
  var archiveName = process.argv[4];
  var outputDirectory = path.resolve(process.argv[5]);
  var sourceArchives = await findArchives(sourceDirectory, archiveName);
  if (sourceArchives.length !== 1) {
    throw new Error(
      `Expected exactly one ${archiveName} below ${sourceDirectory}; found ${sourceArchives.length}`,
    );
  }
  await rm(outputDirectory, { force: true, recursive: true });
  await mkdir(outputDirectory, { recursive: true });
  await copyFile(sourceArchives[0], path.join(outputDirectory, archiveName));
  console.log(`Staged canonical prebuild ${archiveName}`);
  process.exit(0);
}

var archivePath = path.resolve(process.argv[2] || "");
var expectedName = process.argv[3];
if (!expectedName || path.basename(archivePath) !== expectedName) {
  throw new Error(`Expected canonical prebuild archive ${expectedName}`);
}

await rm(modulePath, { force: true, recursive: true });
await mkdir(modulePath, { recursive: true });
var extraction = spawnSync(
  "tar",
  ["-xzf", archivePath, "-C", modulePath, "--strip-components=1"],
  { stdio: "inherit" },
);
if (extraction.status !== 0) {
  throw new Error(`Failed to extract ${expectedName}`);
}

var digest = addonDigest();
await writeFile(checksumPath, `${digest}\n`);
console.log(`Installed ${expectedName} (${digest})`);
