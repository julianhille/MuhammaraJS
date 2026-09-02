#!/bin/sh
set -eu

openssl_version="${OPENSSL_VERSION:?OPENSSL_VERSION is required}"
target_architecture="${OPENSSL_TARGET_ARCH:?OPENSSL_TARGET_ARCH is required}"
archive="$PWD/packages/native-with-source/src/deps/openssl-${openssl_version}.tar.gz"
source_directory="build/openssl"

if [ ! -f "$archive" ]; then
  echo "Vendored OpenSSL source archive not found: $archive" >&2
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
    linker_flags="-arch arm64"
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

openssl_lib_dir="$PWD/$source_directory"
openssl_cppflags="-I$PWD/$source_directory/include"
openssl_ldflags="-L$PWD/$source_directory ${linker_flags:-}"

if [ -n "${GITHUB_ENV:-}" ]; then
  {
    echo "OPENSSL_LIB_DIR=$openssl_lib_dir"
    echo "CPPFLAGS=$openssl_cppflags"
    echo "LDFLAGS=$openssl_ldflags"
  } >> "$GITHUB_ENV"
else
  export OPENSSL_LIB_DIR="$openssl_lib_dir"
  export CPPFLAGS="$openssl_cppflags"
  export LDFLAGS="$openssl_ldflags"
fi
