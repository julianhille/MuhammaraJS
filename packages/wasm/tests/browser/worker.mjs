import { rtlValidation, runValidation } from "./validation.mjs";

try {
  var result = await runValidation();
  await rtlValidation();
  postMessage({ passed: true, ...result });
} catch (error) {
  postMessage({
    passed: false,
    error: error instanceof Error ? error.message : String(error),
  });
}
