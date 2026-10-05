// Runs the package under Deno without --location, where reading `location`
// throws, as `deno run` starts by default.
import { checkRuntime } from "./smoke.mjs";

var results = [
  await checkRuntime("default options"),
  await checkRuntime("locateFile", {
    locateFile: (file, prefix) => prefix + file,
    // Limits of its own, so it starts a worker of its own.
    limits: { maxOutputBytes: 987654321 },
  }),
];
console.log(JSON.stringify(results));
