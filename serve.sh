#!/usr/bin/env bash
# WHAT IF? Civilization Lab v11.4
# Default behavior is deliberately Node-free: serve the prebuilt dist/ folder.
# To rebuild from source, use npm/Vite separately or tools/build-cdn.py.
set -euo pipefail
cd "$(dirname "$0")"
exec ./RUN_NO_NODE.sh "$@"
