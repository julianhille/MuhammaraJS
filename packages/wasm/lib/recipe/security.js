import { Permission } from "../value-sets.js";
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

/**
 * Creates Recipe security methods matching native Recipe encryption options.
 * @returns {object} Methods mixed into Recipe.prototype.
 */
export function createSecurityMethods() {
  /**
   * Converts Recipe password and permission options to recrypt options.
   * @param {object} options - Recipe options.
   * @param {boolean} [addPermissions=true] - Include the permission flags.
   * @returns {object} Encryption options; empty without a password.
   */
  function getEncryptOptions(options, addPermissions = true) {
    var encryptOptions = {};
    var password = options.password || options.ownerPassword;
    if (password) {
      encryptOptions.password = password;
      encryptOptions.ownerPassword = password;
    }
    if (options.userPassword) {
      encryptOptions.userPassword = options.userPassword;
      if (!encryptOptions.password)
        encryptOptions.password = options.userPassword;
    }
    if (addPermissions && options.userProtectionFlag) {
      encryptOptions.userProtectionFlag = options.userProtectionFlag;
    }
    if (Object.keys(encryptOptions).length && !encryptOptions.userPassword) {
      encryptOptions.userPassword = "";
      if (!encryptOptions.userProtectionFlag) {
        encryptOptions.userProtectionFlag = permission();
      }
    }
    return encryptOptions;
  }
  return {
    /**
     * Converts comma-separated PDF permission names to a user-protection bitmask.
     *
     * @name permission
     * @function
     * @memberof Recipe#
     * @param {RecipePermission} [flags="print"] Permission names separated by
     * commas.
     * @returns {number} Numeric PDF user-protection flags.
     * @throws {Error} If a permission name is unknown.
     */
    permission,
    /**
     * Normalizes Recipe encryption options.
     *
     * @name _getEncryptOptions
     * @function
     * @memberof Recipe#
     * @private
     */
    _getEncryptOptions: getEncryptOptions,
    /**
     * Configures encryption for the finished PDF.
     *
     * @name encrypt
     * @function
     * @memberof Recipe#
     * @param {RecipeEncryptOptions} [options={}] Owner and user passwords and
     * numeric user-protection flags. Supplying only an owner password permits
     * printing by default.
     * @returns {Recipe} The Recipe instance.
     * @throws {TypeError} If `options` is not a non-array object.
     * @throws {Error} If the Recipe has already been finished.
     */
    encrypt: function (options = {}) {
      if (!options || typeof options !== "object" || Array.isArray(options)) {
        throw new TypeError("encrypt options must be an object");
      }
      if (this._endedBytes || this._rebuiltBytes) {
        throw new Error("Cannot encrypt a finished Recipe");
      }
      this.encryption_ = getEncryptOptions(options);
      return this;
    },
  };
}
