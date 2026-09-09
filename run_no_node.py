#!/usr/bin/env python3
"""Run the prebuilt WHAT IF? Civilization Lab without Node.js or npm.

Uses only the Python standard library to serve ./dist over localhost and opens
it in the default browser. The browser build itself uses version-pinned esm.sh
packages at runtime, so internet access is required unless the CDN resources are
already cached by the browser.
"""
from __future__ import annotations

import argparse
import functools
import http.server
import os
from pathlib import Path
import socket
import sys
import threading
import time
import webbrowser

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        # Keep startup output readable; errors still reach stderr via the server.
        if getattr(self.server, "verbose", False):
            super().log_message(fmt, *args)


def choose_port(preferred: int) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            s.bind(("127.0.0.1", 0))
            return int(s.getsockname()[1])


def main() -> int:
    parser = argparse.ArgumentParser(description="Run WHAT IF? Civilization Lab without Node.js")
    parser.add_argument("--port", type=int, default=4173, help="preferred localhost port (default: 4173)")
    parser.add_argument("--no-browser", action="store_true", help="do not open the default browser automatically")
    parser.add_argument("--verbose", action="store_true", help="show HTTP request logs")
    args = parser.parse_args()

    if not (DIST / "index.html").is_file():
        print(f"ERROR: prebuilt runtime not found: {DIST / 'index.html'}", file=sys.stderr)
        return 2

    port = choose_port(args.port)
    handler = functools.partial(QuietHandler, directory=str(DIST))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    server.verbose = bool(args.verbose)
    url = f"http://127.0.0.1:{port}/"

    print("WHAT IF? Civilization Lab v11.4 — no-Node runtime")
    print(f"Serving: {url}")
    print("Node.js/npm are NOT required to run this prebuilt release.")
    print("The current browser build loads version-pinned React/Three packages from esm.sh, so internet access is required at runtime.")
    print("Press Ctrl-C to stop.")

    if not args.no_browser:
        def open_later() -> None:
            time.sleep(0.6)
            try:
                webbrowser.open(url)
            except Exception:
                pass
        threading.Thread(target=open_later, daemon=True).start()

    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
