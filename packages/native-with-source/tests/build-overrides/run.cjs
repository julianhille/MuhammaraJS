var assert = require("node:assert/strict");
var fs = require("node:fs");
var os = require("node:os");
var path = require("node:path");
var { spawnSync } = require("node:child_process");
var { generate, aesFiles } = require("../../src/build-overrides/generate.cjs");

function main() {
  var root = path.resolve(__dirname, "../..");
  var temp = fs.mkdtempSync(path.join(os.tmpdir(), "muhammara-concurrency-"));
  var overrides = path.join(root, "src/build-overrides");
  var pdf = path.join(root, "src/deps/PDFWriter");
  var generated = path.join(temp, "generated");
  var useGyp = process.argv.includes("--gyp");
  var flags = ["-O1", "-g", "-pthread"];
  if (process.argv.includes("--tsan")) flags.push("-fsanitize=thread");
  if (process.argv.includes("--aes-ni")) flags.push("-DINTEL_AES_POSSIBLE");
  if (process.argv.includes("--ia32")) flags.push("-m32");
  function run(command, args, options = {}) {
    var result = spawnSync(command, args, {
      stdio: "inherit",
      timeout: 90000,
      ...options,
    });
    if (result.error) throw result.error;
    assert.equal(
      result.status,
      0,
      `${command} failed (${result.signal || result.status})`,
    );
  }

  try {
    generate(generated);
    var linked = path.join(temp, "linked-deps");
    fs.symlinkSync(path.join(root, "src/deps"), linked, "dir");
    assert.throws(() => generate(linked), /outside src\/deps/);
    assert.throws(
      () => generate(path.join(root, "src/deps/forbidden")),
      /outside src\/deps/,
    );
    // A changed patch anchor must fail before producing any partial build copies.
    var changed = path.join(temp, "changed-deps");
    fs.mkdirSync(path.join(changed, "PDFWriter"), { recursive: true });
    fs.writeFileSync(
      path.join(changed, "PDFWriter/Trace.cpp"),
      "changed vendor source",
    );
    assert.throws(
      () => generate(path.join(temp, "rejected"), changed),
      /override mismatch/,
    );
    assert.equal(fs.existsSync(path.join(temp, "rejected")), false);

    var objects = [];
    for (var name of useGyp
      ? []
      : aesFiles.filter((name) => name.endsWith(".c"))) {
      var object = path.join(temp, name + ".o");
      run(process.env.CC || "cc", [
        ...flags,
        "-I" + overrides,
        "-c",
        path.join(generated, name),
        "-o",
        object,
      ]);
      objects.push(object);
    }
    var sources = [
      ...["Trace.cpp", "Log.cpp", "PDFDate.cpp"].map((name) =>
        path.join(generated, name),
      ),
      ...[
        "OutputFile.cpp",
        "OutputFileStream.cpp",
        "OutputBufferedStream.cpp",
      ].map((name) => path.join(pdf, name)),
      ...objects,
    ];
    if (useGyp) {
      var build = path.join(root, "build");
      var linkRule = fs
        .readFileSync(path.join(build, "muhammara.target.mk"), "utf8")
        .split("\n")
        .find((line) =>
          line.startsWith("$(obj).target/muhammara.node: $(OBJS)"),
        );
      assert.ok(linkRule.includes("src/build-overrides/muhammara_aesgm.a"));
      assert.ok(!linkRule.includes("src/deps/LibAesgm"));
      var pdfRule = fs.readFileSync(
        path.join(build, "src/build-overrides/pdfwriter.target.mk"),
        "utf8",
      );
      for (var name of ["Trace", "Log", "PDFDate"]) {
        assert.ok(pdfRule.includes(`gen/native-build-overrides/${name}.o`));
        assert.ok(!pdfRule.includes(`src/deps/PDFWriter/${name}.o`));
      }
      sources = ["pdfwriter.a", "muhammara_aesgm.a"].map((name) =>
        path.join(build, "Release/obj.target/src/build-overrides", name),
      );
    }
    var binary = path.join(temp, "concurrency");
    run(process.env.CXX || "c++", [
      ...flags,
      "-std=c++17",
      "-I" + overrides,
      "-I" + generated,
      "-I" + pdf,
      path.join(__dirname, "concurrency.cpp"),
      ...sources,
      "-o",
      binary,
    ]);
    for (var zone of ["UTC", "America/New_York"]) {
      var output = path.join(temp, zone.replaceAll("/", "-"));
      fs.mkdirSync(output);
      run(binary, [output], { env: { ...process.env, TZ: zone } });
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

// Mocha also discovers .cjs files recursively; compiling this harness is opt-in.
if (require.main === module) main();
