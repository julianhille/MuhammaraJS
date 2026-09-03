import Muhammara = require("./muhammara");

declare namespace NativeCore {
  export type MuhammaraApi = typeof Muhammara;
  export function createMuhammara(addon: object): MuhammaraApi;
}

export = NativeCore;
