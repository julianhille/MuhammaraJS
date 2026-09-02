import { runValidation } from "./validation.mjs";

var resultElement = document.getElementById("result");

function workerValidation() {
  return new Promise((resolve, reject) => {
    var worker = new Worker("./worker.mjs", { type: "module" });
    var timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("worker validation timed out"));
    }, 30000);

    worker.onmessage = (event) => {
      clearTimeout(timeout);
      worker.terminate();
      if (event.data.passed) resolve(event.data);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(event.message));
    };
  });
}

async function report(result) {
  resultElement.textContent = JSON.stringify(result);
  await fetch("/__wasm_browser_result__", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(result),
  });
}

try {
  var page = await runValidation();
  var worker = await workerValidation();
  await report({ passed: true, page, worker });
} catch (error) {
  await report({
    passed: false,
    error: error instanceof Error ? error.message : String(error),
  });
}
