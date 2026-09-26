var fs = require("node:fs");
var path = require("node:path");

/**
 * Writes PDF bytes to tests/output/<name>.pdf for manual review.
 * @param {string} name File name without extension.
 * @param {Buffer|Uint8Array} bytes PDF bytes.
 * @returns {string} The written file path.
 */
function writeOutput(name, bytes) {
  var dir = path.join(__dirname, "..", "output");
  fs.mkdirSync(dir, { recursive: true });
  var file = path.join(dir, name + ".pdf");
  fs.writeFileSync(file, bytes);
  return file;
}

module.exports = { writeOutput };
