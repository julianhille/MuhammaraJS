#!/bin/sh
set -eu

package_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
archive="$package_root/src/deps/openssl-3.5.4.tar.gz"
source_directory="$package_root/build/openssl"
target_architecture=${OPENSSL_TARGET_ARCH:-${npm_config_target_arch:-${npm_config_arch:-}}}

if [ -z "$target_architecture" ]; then
  case "$(uname -m)" in
    x86_64) target_architecture=x64 ;;
    aarch64|arm64) target_architecture=arm64 ;;
    *)
      echo "Unsupported OpenSSL build architecture: $(uname -m)" >&2
      exit 1
      ;;
  esac
fi

if [ ! -f "$archive" ]; then
  echo "Bundled OpenSSL source archive not found: $archive" >&2
  exit 1
fi

rm -rf "$source_directory"
mkdir -p "$source_directory"
tar -xzf "$archive" --strip-components=1 -C "$source_directory"

case "$(uname -s)-$target_architecture" in
  Linux-x64) openssl_target=linux-x86_64 ;;
  Linux-arm64) openssl_target=linux-aarch64 ;;
  Darwin-x64) openssl_target=darwin64-x86_64-cc ;;
  Darwin-arm64)
    openssl_target=darwin64-arm64-cc
    export CFLAGS="${CFLAGS:-} -arch arm64"
    export LDFLAGS="${LDFLAGS:-} -arch arm64"
    ;;
  *)
    echo "Unsupported OpenSSL build target: $(uname -s)-$target_architecture" >&2
    exit 1
    ;;
esac

(
  cd "$source_directory"
  ./Configure "$openssl_target" no-shared no-apps no-tests
  make -j"$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)" build_libs
)
