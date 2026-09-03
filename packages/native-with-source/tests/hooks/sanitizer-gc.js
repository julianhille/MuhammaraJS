"use strict";

exports.mochaHooks = {
  afterAll: function () {
    global.gc();
    global.gc();
  },
};
