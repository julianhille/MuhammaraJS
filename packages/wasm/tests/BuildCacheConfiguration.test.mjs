// The compiler cache is only safe while sanitizer and normal builds stay in
// separate directories, and only effective while CI derives those directories
// from the build script instead of repeating its layout.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

var repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
var buildScript = fileURLToPath(new URL("../build.sh", import.meta.url));

function directory(flag, environment) {
  return execFileSync(buildScript, [flag], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: Object.assign({}, process.env, environment),
  }).trim();
}

describe("BuildCacheConfiguration", function () {
  it("keeps sanitizer and normal builds in separate directories", function () {
    var normalCache = directory("--print-cache-directory", {
      MUHAMMARA_WASM_SANITIZE: "OFF",
    });
    var sanitizerCache = directory("--print-cache-directory", {
      MUHAMMARA_WASM_SANITIZE: "ON",
    });
    var normalBuild = directory("--print-build-directory", {
      MUHAMMARA_WASM_SANITIZE: "OFF",
    });
    var sanitizerBuild = directory("--print-build-directory", {
      MUHAMMARA_WASM_SANITIZE: "ON",
    });

    assert.notEqual(normalCache, sanitizerCache);
    assert.notEqual(normalBuild, sanitizerBuild);
    assert.match(normalCache, /packages\/wasm\/\.ccache\/[^/]+$/);
    assert.match(sanitizerCache, /packages\/wasm\/\.ccache\/[^/]+$/);
    assert.match(normalBuild, /packages\/wasm\/build\/[^/]+$/);
    assert.match(sanitizerBuild, /packages\/wasm\/build\/[^/]+$/);
  });

  it("honours the cache directory and build type overrides", function () {
    assert.equal(
      directory("--print-cache-directory", {
        MUHAMMARA_WASM_CCACHE_DIR: "/tmp/muhammara-wasm-cache",
        MUHAMMARA_WASM_SANITIZE: "OFF",
      }),
      "/tmp/muhammara-wasm-cache/release-sanitize-off",
    );
    assert.match(
      directory("--print-build-directory", {
        MUHAMMARA_WASM_BUILD_TYPE: "Debug",
        MUHAMMARA_WASM_SANITIZE: "ON",
      }),
      /\/debug-sanitize-on$/,
    );
  });

  it("rejects unknown arguments instead of starting a build", function () {
    var status = null;
    try {
      execFileSync(buildScript, ["--print-cache-dir"], {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (error) {
      status = error.status;
    }

    assert.equal(status, 2);
  });

  it("lets the Wasm workflow derive its cache from the build script", function () {
    var action = readFileSync(
      new URL(
        "../../../.github/actions/setup-wasm-build-cache/action.yml",
        import.meta.url,
      ),
      "utf8",
    );
    var workflow = readFileSync(
      new URL("../../../.github/workflows/ci-wasm.yml", import.meta.url),
      "utf8",
    );

    assert.ok(action.includes("--print-cache-directory"));
    assert.ok(action.includes("packages/wasm/CMakeLists.txt"));
    assert.ok(action.includes("packages/wasm/src/**"));
    assert.ok(action.includes("packages/native-with-source/src/**"));
    assert.ok(workflow.includes('sanitize: "OFF"'));
    assert.ok(workflow.includes('sanitize: "ON"'));
  });
});
