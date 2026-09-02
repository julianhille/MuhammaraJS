import { runValidation } from "./validation.mjs";

try {
  var result = await runValidation();
  postMessage({ passed: true, ...result });
} catch (error) {
  postMessage({
    passed: false,
    error: error instanceof Error ? error.message : String(error),
  });
}
