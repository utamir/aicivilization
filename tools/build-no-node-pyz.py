#!/usr/bin/env python3
"""Build a single-file Python zipapp containing the prebuilt browser runtime.

Runtime requirement: Python 3 + a modern browser. Node/npm are not required.
The embedded browser app uses version-pinned esm.sh packages, so internet access
is required while those third-party modules load.
"""
from __future__ import annotations

from pathlib import Path
import shutil
import tempfile
import zipapp

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = ROOT / "standalone" / "CivilizationLab_NoNode.pyz"

MAIN = r'''from __future__ import annotations
import argparse
import http.server
import mimetypes
from pathlib import PurePosixPath
import socket
import sys
import threading
import time
import urllib.parse
import webbrowser
import zipfile

ARCHIVE = sys.argv[0]
PREFIX = "dist/"

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        raw = urllib.parse.urlparse(self.path).path
        rel = urllib.parse.unquote(raw).lstrip("/") or "index.html"
        p = PurePosixPath(rel)
        if ".." in p.parts:
            self.send_error(400, "bad path")
            return
        name = PREFIX + str(p)
        try:
            with zipfile.ZipFile(ARCHIVE, "r") as zf:
                data = zf.read(name)
        except KeyError:
            self.send_error(404, "not found")
            return
        ctype, _ = mimetypes.guess_type(str(p))
        self.send_response(200)
        self.send_header("Content-Type", ctype or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        if getattr(self.server, "verbose", False):
            super().log_message(fmt, *args)


def choose_port(preferred):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            s.bind(("127.0.0.1", 0))
            return s.getsockname()[1]


def main():
    ap = argparse.ArgumentParser(description="WHAT IF? Civilization Lab — single-file no-Node runtime")
    ap.add_argument("--port", type=int, default=4173)
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    ns = ap.parse_args()
    port = choose_port(ns.port)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.verbose = ns.verbose
    url = f"http://127.0.0.1:{port}/"
    print("WHAT IF? Civilization Lab v11 — single-file no-Node runtime")
    print("Serving:", url)
    print("Node.js/npm are NOT required.")
    print("Browser internet access is required for version-pinned esm.sh React/Three packages.")
    print("Press Ctrl-C to stop.")
    if not ns.no_browser:
        def opener():
            time.sleep(0.6)
            try: webbrowser.open(url)
            except Exception: pass
        threading.Thread(target=opener, daemon=True).start()
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
'''

if not (DIST / "index.html").is_file():
    raise SystemExit("dist/index.html is missing; build the browser runtime first")

OUT.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix="civlab_pyz_") as td:
    stage = Path(td)
    (stage / "__main__.py").write_text(MAIN, encoding="utf-8")
    shutil.copytree(DIST, stage / "dist")
    zipapp.create_archive(stage, OUT, interpreter="/usr/bin/env python3", compressed=True)
OUT.chmod(0o755)
print(OUT)
