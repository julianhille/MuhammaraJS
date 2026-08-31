var fs = require("fs");
var path = require("path");

module.exports = function copyOpenSslDlls(packageRoot) {
  if (process.platform !== "win32") {
    return null;
  }

  var bindingDirectory = path.join(packageRoot, "binding");
  var bundledCrypto = fs.existsSync(bindingDirectory)
    ? fs.readdirSync(bindingDirectory).filter(function (file) {
        return /^libcrypto-3.*\.dll$/i.test(file);
      })
    : [];
  var bundledSsl = fs.existsSync(bindingDirectory)
    ? fs.readdirSync(bindingDirectory).filter(function (file) {
        return /^libssl-3.*\.dll$/i.test(file);
      })
    : [];

  if (bundledCrypto.length === 1 && bundledSsl.length === 1) {
    return {
      bindingDirectory: bindingDirectory,
      dlls: bundledCrypto.concat(bundledSsl),
      opensslBinDirectory: null,
    };
  }

  if (bundledCrypto.length !== 0 || bundledSsl.length !== 0) {
    throw new Error(
      "The Windows binding contains an incomplete OpenSSL DLL set",
    );
  }

  if (process.env.OPENSSL_LIB_DIR) {
    fs.copyFileSync(
      path.join(__dirname, "..", "THIRD_PARTY_NOTICES.md"),
      path.join(bindingDirectory, "THIRD_PARTY_NOTICES.md"),
    );
    return;
  }

  if (!process.env.OPENSSL_DIR) {
    throw new Error(
      "OPENSSL_DIR is required to bundle OpenSSL DLLs after a Windows source build",
    );
  }

  var opensslBinDirectory = path.join(process.env.OPENSSL_DIR, "bin");
  if (!fs.existsSync(opensslBinDirectory)) {
    throw new Error(
      "OpenSSL bin directory does not exist: " + opensslBinDirectory,
    );
  }

  var requiredDlls = ["libcrypto", "libssl"].map(function (library) {
    var matches = fs.readdirSync(opensslBinDirectory).filter(function (file) {
      return new RegExp("^" + library + "-3.*\\.dll$", "i").test(file);
    });

    if (matches.length !== 1) {
      throw new Error(
        "Expected one " + library + "-3*.dll in " + opensslBinDirectory,
      );
    }

    return matches[0];
  });

  requiredDlls.forEach(function (dll) {
    fs.copyFileSync(
      path.join(opensslBinDirectory, dll),
      path.join(bindingDirectory, dll),
    );
  });

  fs.copyFileSync(
    path.join(__dirname, "..", "THIRD_PARTY_NOTICES.md"),
    path.join(bindingDirectory, "THIRD_PARTY_NOTICES.md"),
  );

  return {
    bindingDirectory: bindingDirectory,
    dlls: requiredDlls,
    opensslBinDirectory: opensslBinDirectory,
  };
};

if (require.main === module) {
  module.exports(process.argv[2] || process.cwd());
}
