#!/usr/bin/env bash
# Installs the pinned Flutter SDK for a remote/cloud coding session, where no
# SDK is preinstalled. Safe to run repeatedly. Not needed on your own machine
# if `flutter --version` already reports the version below.
#
#   source tool/setup_remote_flutter.sh    # also puts flutter on PATH
set -euo pipefail

FLUTTER_VERSION="3.50.1"   # keep in sync with .github/workflows/ride-doctor-ci.yml
SDK_ROOT="${FLUTTER_SDK_ROOT:-/opt/sdk}"

if [ ! -x "$SDK_ROOT/flutter/bin/flutter" ]; then
  mkdir -p "$SDK_ROOT"
  archive="https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz"
  echo "Downloading Flutter $FLUTTER_VERSION (about 1.5 GB)..."
  curl -fsS -o "$SDK_ROOT/flutter.tar.xz" "$archive"
  tar -xf "$SDK_ROOT/flutter.tar.xz" -C "$SDK_ROOT"
  rm "$SDK_ROOT/flutter.tar.xz"
  git config --global --add safe.directory "$SDK_ROOT/flutter"
fi

export PATH="$SDK_ROOT/flutter/bin:$PATH"
flutter config --no-analytics >/dev/null 2>&1 || true
flutter --version
