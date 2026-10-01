var assert = require("assert");
var { runBenchmark, formatTable } = require("../benchmarks/recrypt-server");

describe("recrypt server benchmark", function () {
  it("measures both modes against a running server", async function () {
    this.timeout(60000);
    var result = await runBenchmark({
      input: __dirname + "/TestMaterials/Original.pdf",
      requests: 3,
      concurrency: 2,
      pingInterval: 5,
    });
    assert.deepEqual(
      result.results.map(function (entry) {
        return entry.mode;
      }),
      ["sync", "async"],
    );
    result.results.forEach(function (entry) {
      assert.equal(entry.recrypt.count, 3);
      assert.ok(entry.ping.count > 0);
      assert.ok(entry.loop.utilization >= 0 && entry.loop.utilization <= 1);
    });
    assert.match(formatTable(result), /loop delay max/);
  });
});
