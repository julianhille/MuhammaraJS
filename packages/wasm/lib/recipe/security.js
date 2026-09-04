/** Converts comma-separated PDF permission names to a bitmask. */
export function permission(flags = "print") {
  var bits = {
    print: 4,
    modify: 8,
    copy: 16,
    edit: 32,
    fillform: 256,
    extract: 512,
    assemble: 1024,
    printbest: 2048,
  };
  return String(flags)
    .split(",")
    .reduce((value, flag) => {
      flag = flag.trim();
      if (!bits[flag])
        throw new Error(`Unknown user access permission (${flag})`);
      return value + bits[flag];
    }, 0);
}

/** Creates Recipe security methods, including unsupported-operation reporting. */
export function createSecurityMethods() {
  return {
    permission,
    encrypt: function () {
      throw new Error(
        "Recipe encryption is unsupported in WebAssembly because this build excludes OpenSSL",
      );
    },
  };
}
