// Checks one Wasm instance in the current runtime: it loads, recrypts, and
// runs recryptAsync() in its worker, so the calling thread keeps running.
// Shared by the Deno and jsdom runs, which load the package as users do.
import { createMuhammaraWasm } from "../../index.js";

/**
 * Throws when `condition` does not hold.
 * @param {*} condition - What must hold.
 * @param {string} message - What failed.
 * @returns {void}
 */
function check(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Writes an uncompressed PDF whose recrypt takes long enough for timers to
 * run many times while a worker recrypts it.
 * @param {object} muhammara - The Wasm API.
 * @returns {Uint8Array} The PDF.
 */
function largePdf(muhammara) {
  var writer = muhammara.createWriter({ compress: false });
  for (var index = 0; index < 200; index++) {
    var page = writer.createPage(0, 0, 595, 842);
    var context = writer.startPageContentContext(page);
    for (var row = 0; row < 120; row++) {
      context
        .q()
        .rg(0.2, 0.4, 0.6)
        .re(40, 40 + row * 6, 500, 4)
        .f()
        .Q();
    }
    writer.writePage(page);
  }
  return writer.end();
}

/**
 * Counts how often a 0 ms timer runs while `run` is pending.
 * @param {function(): Promise<*>} run - Starts the call.
 * @returns {Promise<{result: *, turns: number}>} Its result and the count.
 */
async function timerTurnsDuring(run) {
  var turns = 0;
  var counting = true;
  /**
   * Counts one timer turn and queues the next.
   * @returns {void}
   */
  function turn() {
    if (!counting) return;
    turns++;
    setTimeout(turn, 0);
  }
  setTimeout(turn, 0);
  try {
    return { result: await run(), turns };
  } finally {
    counting = false;
  }
}

/**
 * Loads an instance and checks recrypt() and recryptAsync().
 * @param {string} label - Names the run in failures.
 * @param {object} [options] - createMuhammaraWasm() options.
 * @returns {Promise<{label: string, turns: number}>} What was measured.
 */
export async function checkRuntime(label, options) {
  var muhammara = await createMuhammaraWasm(options);
  var source = largePdf(muhammara);
  var encrypted = muhammara.recrypt(source, { userPassword: "view" });
  var reader = muhammara.createReader(encrypted, { password: "view" });
  check(reader.isEncrypted(), `${label}: recrypt() encrypts`);
  reader.end();
  // The first call starts the worker; a worker that cannot load the binary
  // leaves the next call on the calling thread, where no timer runs.
  await muhammara.recryptAsync(muhammara.createBlankPdf(10, 10));
  var { result, turns } = await timerTurnsDuring(() =>
    muhammara.recryptAsync(source, { userPassword: "view" }),
  );
  check(turns > 0, `${label}: recryptAsync() ran on the calling thread`);
  reader = muhammara.createReader(result, { password: "view" });
  check(reader.isEncrypted(), `${label}: recryptAsync() encrypts`);
  reader.end();
  return { label, turns };
}
