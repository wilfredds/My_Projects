#!/usr/bin/env bash
# Downloads SQLite compiled to WebAssembly into web/, for the web preview.
# The browser cannot load the phone's native SQLite library, so the web build
# needs this file served next to the app. Run once before `flutter build web`
# or `flutter run -d chrome`.
#
# The version must match the `sqlite3` package in pubspec.lock; the checksum
# is the one that package itself pins for this file.
set -euo pipefail

SQLITE3_PACKAGE_VERSION="3.9.2"
SHA256="e7451780e78c56ff864fe9317a0fbcd6aeb2e8de3beba7f5efd963202f7ec3d9"

cd "$(dirname "$0")/.."
target="web/sqlite3.wasm"

if [ -f "$target" ] && echo "$SHA256  $target" | sha256sum --check --status; then
  echo "$target is already up to date."
  exit 0
fi

curl -fsSL -o "$target" \
  "https://github.com/simolus3/sqlite3.dart/releases/download/sqlite3-${SQLITE3_PACKAGE_VERSION}/sqlite3.wasm"
echo "$SHA256  $target" | sha256sum --check
