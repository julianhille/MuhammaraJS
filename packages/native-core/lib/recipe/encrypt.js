const fs = require("fs");
const { Permission } = require("../recipe-constants");
const PDFWStreamForBuffer = require("../PDFWStreamForBuffer");

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
exports.permission = function permission(flags = Permission.PRINT) {
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
 * @param {boolean} [addPermissions=true] - Copy `userProtectionFlag` into the result.
 * @returns {Object} The writer encryption options; empty when no password is set.
 */
exports._getEncryptOptions = function _getEncryptOptions(
  options,
  addPermissions = true,
) {
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

  if (addPermissions) {
    if (options.userProtectionFlag) {
      encryptOptions.userProtectionFlag = options.userProtectionFlag;
    }
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
 */
exports.encrypt = function encrypt(options = {}) {
  this.needToEncrypt = true;
  this.encryption_ = this._getEncryptOptions(options);

  return this;
};

// http://pdfhummus.com/post/147451287581/hummus-1058-and-pdf-writer-updates-encryption
/**
 * Re-encrypt the finished output with the encrypt() options. A path source
 * re-encrypts the output file in place; a Buffer source re-encrypts the
 * collected output bytes, so the callback and an output path receive the
 * encrypted PDF. The finished output is opened with the password the Recipe
 * was created with, so a PDF whose constructor options already encrypted it
 * can still be re-encrypted with new passwords. encrypt() without a password
 * or userProtectionFlag leaves the output unencrypted, as on Wasm: it removes
 * the constructor encryption, and does nothing when the Recipe was created
 * without one.
 * @private
 * @returns {void}
 * @throws {Error} If the output cannot be renamed, re-encrypted or removed.
 */
exports._encrypt = function _encrypt() {
  const encryption = this.encryption_ || {};
  const hasEncryption = Object.keys(encryption).length > 0;
  if (!hasEncryption && !this.encryptOptions.password) {
    return;
  }
  // Without new passwords, recrypt only decrypts with the opening password.
  const recryptOptions = Object.assign({}, encryption, {
    password: this.encryptOptions.password || encryption.password,
  });

  if (this.isBufferSrc) {
    const encrypted = new PDFWStreamForBuffer();
    this.muhammara.recrypt(
      new this.muhammara.PDFRStreamForBuffer(
        this.outStream.buffer || Buffer.alloc(0),
      ),
      encrypted,
      recryptOptions,
    );
    // Replace the collected bytes instead of the stream, so the unencrypted
    // output is dropped rather than kept alive next to the encrypted one.
    this.outStream.buffer = encrypted.buffer;
    return;
  }

  const tmp = this.output + ".tmp.pdf";
  fs.renameSync(this.output, tmp);
  this.muhammara.recrypt(tmp, this.output, recryptOptions);
  fs.unlinkSync(tmp);
};
