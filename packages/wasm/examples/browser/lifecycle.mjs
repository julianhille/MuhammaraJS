export function throwIfCancelled(signal) {
  if (signal?.aborted)
    throw new DOMException("Operation cancelled", "AbortError");
}

export function errorDetails(error, stage) {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
    stage,
    stack: error instanceof Error ? error.stack : undefined,
  };
}

export class ObjectUrlStore {
  constructor(urlApi = URL) {
    this.urlApi = urlApi;
    this.current = undefined;
  }

  replace(bytes, type = "application/pdf") {
    this.revoke();
    this.current = this.urlApi.createObjectURL(new Blob([bytes], { type }));
    return this.current;
  }

  revoke() {
    if (!this.current) return false;
    this.urlApi.revokeObjectURL(this.current);
    this.current = undefined;
    return true;
  }

  dispose() {
    this.revoke();
  }
}

export function endQuietly(owner) {
  try {
    owner?.end?.();
  } catch {
    owner?.dispose?.();
  }
}
