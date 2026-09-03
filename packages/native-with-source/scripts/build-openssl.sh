#!/bin/sh
set -eu

package_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
archive="$package_root/src/deps/openssl-3.5.4.tar.gz"
target_architecture=${1:-${OPENSSL_TARGET_ARCH:-${npm_config_target_arch:-${npm_config_arch:-}}}}

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

source_directory="$package_root/openssl-build/$target_architecture"
build_stamp="$source_directory/.build-stamp"

# An explicit C compiler already contains any cross-compilation prefix.
if [ -n "${CC:-}" ]; then
  export CROSS_COMPILE=
fi

if [ ! -f "$archive" ]; then
  echo "Bundled OpenSSL source archive not found: $archive" >&2
  exit 1
fi

case "$(uname -s)-$target_architecture" in
  Linux-x64) openssl_target=linux-x86_64 ;;
  Linux-arm64) openssl_target=linux-aarch64 ;;
  Darwin-x64)
    openssl_target=darwin64-x86_64-cc
    export CFLAGS="${CFLAGS:-} -arch x86_64"
    export LDFLAGS="${LDFLAGS:-} -arch x86_64"
    ;;
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

expected_stamp=$(printf '%s\n' "$(shasum -a 256 "$archive" | cut -d ' ' -f 1)" "${CC:-}" "${CFLAGS:-}" "${LDFLAGS:-}" "$target_architecture" "$openssl_target" | shasum -a 256 | cut -d ' ' -f 1)

if [ -f "$source_directory/libcrypto.a" ] && [ -f "$build_stamp" ] && [ "$(cat "$build_stamp")" = "$expected_stamp" ]; then
  exit 0
fi

rm -rf "$source_directory"
mkdir -p "$source_directory"
tar -xzf "$archive" --strip-components=1 -C "$source_directory"

(
  cd "$source_directory"
  ./Configure "$openssl_target" no-shared no-apps no-tests
  make -j"$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)" build_libs
)

test -f "$source_directory/libcrypto.a"
printf '%s\n' "$expected_stamp" > "$build_stamp"
