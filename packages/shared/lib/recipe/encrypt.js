import { Permission } from "../recipe-constants.js";

/**
 * Encryption user access permissions
 *
 * This function supplies the numeric value for the encrypt function's 'userProtectionFlag'
 * option. When no argument is given, the default 'print' value is used.
 *
 * @name permission
 * @function
 * @memberof Recipe#
 * @param {string} [flags='print'] One or more `Recipe.Permission` values
 * (print, modify, copy, edit, fillform, extract, assemble, printbest),
 * separated by commas, for example `[Permission.PRINT, Permission.COPY].join()`.
 * @returns {number} The numeric user protection flag.
 * @throws {Error} If a name is not a `Recipe.Permission` value.
 */
export const permission = function permission(flags = Permission.PRINT) {
  // https://www.adobe.com/content/dam/acom/en/devnet/pdf/pdfs/PDF32000_2008.pdf

  const userAccessPermissions = {
    // see table on page 61 of above document
    [Permission.PRINT]: 1 << 2, // allow printing
    [Permission.MODIFY]: 1 << 3, // allow template creation, signing, filling form fields
    [Permission.COPY]: 1 << 4, // allow content copying and copying for accessibility
    [Permission.EDIT]: 1 << 5, // allow commenting
    [Permission.FILL_FORM]: 1 << 8, // allow filling of form fields
    [Permission.EXTRACT]: 1 << 9, // allow content copying for accessibility
    [Permission.ASSEMBLE]: 1 << 10, // unused
    [Permission.PRINT_BEST]: 1 << 11, // allow high resolution printing when 'print' is allowed
  };

  const perms = flags.split(",").map((x) => {
    return x.trim();
  });
  let access = 0;
  perms.forEach((perm) => {
    if (!userAccessPermissions[perm]) {
      throw new Error(`Unknown user access permission (${perm})`);
    }
    access += userAccessPermissions[perm];
  });

  return access;
};

/**
 * Build writer encryption options from Recipe options. `password` and
 * `ownerPassword` are aliases; when only an owner password is given the user
 * password is empty and the default permission applies.
 * @private
 * @param {Object} options - The Recipe or encrypt() options.
 * @returns {Object} The writer encryption options; empty when no password is set.
 */
export const _getEncryptOptions = function _getEncryptOptions(options) {
  const encryptOptions = {};

  const password = options.password || options.ownerPassword;
  if (password) {
    encryptOptions.password = password;
    encryptOptions.ownerPassword = password;
  }

  if (options.userPassword) {
    encryptOptions.userPassword = options.userPassword;
    if (!encryptOptions.password) {
      encryptOptions.password = options.userPassword;
    }
  }

  if (options.userProtectionFlag) {
    encryptOptions.userProtectionFlag = options.userProtectionFlag;
  }

  // Only attach encryption mechanism when attributes
  // have been explicitly given in the incoming options.
  if (Object.keys(encryptOptions).length > 0 && !encryptOptions.userPassword) {
    encryptOptions.userPassword = "";
    if (!encryptOptions.userProtectionFlag) {
      encryptOptions.userProtectionFlag = this.permission();
    }
  }

  return encryptOptions;
};

/**
 * Encrypt the pdf
 * @name encrypt
 * @function
 * @memberof Recipe#
 * @param {Object} [options] - The options
 * @param {string} [options.password] - The permission password.
 * @param {string} [options.ownerPassword] - The password for editing.
 * @param {string} [options.userPassword] - The password for viewing & encryption.
 * @param {number} [options.userProtectionFlag] - The flag for the security level, see `permission()`.
 * @returns {Recipe} The recipe instance. The output is encrypted by `endPDF()`:
 *   the output file for a path source, and the Buffer passed to the callback
 *   (or written to the output path) for a Buffer source.
 * @throws {Error} If the Recipe writes PDF/A, which does not allow encryption.
 */
export const encrypt = function encrypt(options = {}) {
  if (this.pdfa_) throw new Error("PDF/A does not allow encryption");
  this.needToEncrypt = true;
  const encryption = this._getEncryptOptions(options);
  // an empty encrypt() keeps the constructor passwords of a new PDF
  if (Object.keys(encryption).length) this.encryption_ = encryption;

  return this;
};

// http://pdfhummus.com/post/147451287581/hummus-1058-and-pdf-writer-updates-encryption
/**
 * Encrypt the finished output, once, with `encryption_`: the constructor
 * passwords of a new PDF, or the encrypt() options, which replace them. A
 * source keeps its own encryption unless encrypt() replaces it, and is opened
 * with the password the Recipe was created with.
 * @private
 * @param {Uint8Array} bytes - The finished output.
 * @returns {Uint8Array} The encrypted output, or the same bytes when there is
 *   nothing to encrypt.
 * @throws {Error} If the output cannot be encrypted.
 */
export const _encrypt = function _encrypt(bytes) {
  return Object.keys(this.encryption_).length
    ? this.platform.recrypt(bytes, {
        ...this.encryption_,
        password: this.encryptOptions.password,
      })
    : bytes;
};
