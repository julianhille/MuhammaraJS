// Replays inputs the fuzzer (tests/fuzz) once crashed the module with, kept
// with the shared fixtures in TestMaterials/fuzz. Each file is named after the
// target that found it and must now run through that target without a trap,
// abort, escaped exception, or JavaScript error in the glue.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createMuhammaraWasm, createRecipe } from "../../index.js";
import { classifyError, targets } from "../fuzz/targets.mjs";
import { fuzzInputs as directory } from "../malformedInputs.mjs";

var inputs = fs
  .readdirSync(directory)
  .filter((name) => name.endsWith(".bin"))
  .sort();

describe("fuzz regressions", function () {
  this.timeout(60000);

  it("has a target for every input", function () {
    assert.ok(inputs.length > 0);
    for (var name of inputs) {
      assert.ok(targets[name.split("-")[0]], `no fuzz target for ${name}`);
    }
  });

  inputs.forEach((name) => {
    it(`runs ${name}`, async function () {
      var target = name.split("-")[0];
      var options = { recryptWorker: false };
      // A fresh instance per input, as the fuzzer confirms a finding: heap
      // corruption from one input cannot surface in the next.
      var context = {
        muhammara: await createMuhammaraWasm(options),
        Recipe: target === "recipe" ? await createRecipe(options) : undefined,
      };
      var bytes = new Uint8Array(fs.readFileSync(path.join(directory, name)));
      try {
        targets[target].run(context, bytes);
      } catch (error) {
        // Rejecting the input is fine; crashing on it is not.
        assert.equal(classifyError(error), null, error?.stack);
      }
    });
  });
});
