#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  exec python3 ./run_no_node.py "$@"
elif command -v python >/dev/null 2>&1; then
  exec python ./run_no_node.py "$@"
else
  echo "Python 3 is required for the included local web server. Node.js is not required." >&2
  echo "Alternatively, serve the dist/ folder with any static HTTP server." >&2
  exit 1
fi
