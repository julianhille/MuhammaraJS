import { Permission } from "@muhammara/shared/value-sets.js";
/**
 * Converts comma-separated PDF permission names to a user-protection bitmask.
 *
 * @name permission
 * @function
 * @memberof Recipe
 * @param {RecipePermission} [flags="print"] Permission names separated by
 * commas.
 * @returns {number} Numeric PDF user-protection flags.
 * @throws {Error} If a permission name is unknown.
 */
export function permission(flags = Permission.PRINT) {
  var bits = {
    [Permission.PRINT]: 4,
    [Permission.MODIFY]: 8,
    [Permission.COPY]: 16,
    [Permission.EDIT]: 32,
    [Permission.FILL_FORM]: 256,
    [Permission.EXTRACT]: 512,
    [Permission.ASSEMBLE]: 1024,
    [Permission.PRINT_BEST]: 2048,
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
