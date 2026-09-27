"use strict";

/**
 * Runs garbage collection and lets pending native finalizers run.
 *
 * @returns {Promise<void>} Resolves after the finalizers had a chance to run.
 */
async function collectGarbage() {
  for (var i = 0; i < 5; i++) {
    global.gc();
    await new Promise(function (resolve) {
      setTimeout(resolve, 10);
    });
  }
}

module.exports = { collectGarbage };
