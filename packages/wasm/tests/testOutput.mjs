import fs from "node:fs";
import path from "node:path";

/** Writes PDF bytes to tests/output/<name>.pdf for manual review. */
export function writeOutput(name, bytes) {
  var dir = path.join(process.cwd(), "tests", "output");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + ".pdf"), Buffer.from(bytes));
}
