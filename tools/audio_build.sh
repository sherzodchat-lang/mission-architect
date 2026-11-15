#!/usr/bin/env bash
# Rebuild public/audio from assets_src/audio/raw + the take choices in assets_src/audio/manifest.json.
# Swap a take: edit "choice" ("a" / "b") of an item in the manifest, then run:  tools/audio_build.sh [item ids...]
set -euo pipefail
cd "$(dirname "$0")/.."
command -v ffmpeg >/dev/null || { echo "ffmpeg not found" >&2; exit 1; }
node tools/audio_build.mjs "$@"
node tools/public_index.mjs
