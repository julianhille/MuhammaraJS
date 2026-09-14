import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

var repository = "julianhille/MuhammaraJS";
var packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** Fetches JSON from GitHub's public API. */
async function githubJson(endpoint) {
  var response = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "MuhammaraJS-Read-the-Docs",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status} for ${endpoint}`);
  }
  return response.json();
}

/** Returns commit IDs that may identify the current docs checkout. */
function checkoutCommits() {
  var commits = new Set([
    process.env.MUHAMMARA_WASM_ARTIFACT_SHA,
    process.env.READTHEDOCS_GIT_COMMIT_HASH,
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  ]);
  try {
    commits.add(
      execFileSync("git", ["rev-parse", "HEAD^2"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
    );
  } catch {
    // A normal branch or tag checkout has no pull request merge parent.
  }
  commits.delete(undefined);
  return commits;
}

/** Waits for Wasm CI to upload the artifact for this exact checkout. */
async function waitForArtifact(commits) {
  for (var attempt = 1; attempt <= 40; attempt += 1) {
    var result = await githubJson(
      `/repos/${repository}/actions/artifacts?name=muhammara-wasm&per_page=100`,
    );
    /** Matches an unexpired artifact to one of the checkout's commit IDs. */
    function matchesCheckout(candidate) {
      return (
        !candidate.expired && commits.has(candidate.workflow_run?.head_sha)
      );
    }
    var artifact = result.artifacts.find(matchesCheckout);
    if (artifact) return artifact;
    if (attempt < 40) await setTimeout(15000);
  }
  throw new Error(
    `Wasm CI did not upload an artifact for ${Array.from(commits).join(", ")}`,
  );
}

/** Downloads the matching public CI artifact through nightly.link. */
async function downloadWasmArtifact() {
  var artifact = await waitForArtifact(checkoutCommits());
  var run = await githubJson(
    `/repos/${repository}/actions/runs/${artifact.workflow_run.id}`,
  );
  var url = `https://nightly.link/${repository}/suites/${run.check_suite_id}/artifacts/${artifact.id}`;
  var response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Artifact download returned ${response.status}`);
  }

  var archive = path.join(tmpdir(), `muhammara-wasm-${artifact.id}.zip`);
  var bytes = new Uint8Array(await response.arrayBuffer());
  var digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (artifact.digest && digest !== artifact.digest) {
    throw new Error(`Artifact digest mismatch: expected ${artifact.digest}`);
  }
  await writeFile(archive, bytes);
  try {
    execFileSync(
      "python",
      ["-m", "zipfile", "-e", archive, path.join(packageRoot, "dist")],
      { stdio: "inherit" },
    );
  } finally {
    await rm(archive, { force: true });
  }
}

await downloadWasmArtifact();
