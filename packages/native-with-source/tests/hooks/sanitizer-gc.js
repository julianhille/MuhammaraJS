"use strict";

exports.mochaHooks = {
  afterAll: function () {
    if (typeof global.gc !== "function") {
      throw new Error("GC must be exposed for this test run");
    }
    global.gc();
    global.gc();
  },
};
