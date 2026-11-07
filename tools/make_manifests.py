#!/usr/bin/env python3
"""Regenerate RELEASE_MANIFEST.sha256 and SOURCE_MANIFEST.txt from the git index.

Both files are release-verification snapshots: SOURCE_MANIFEST.txt lists every
git-tracked file, RELEASE_MANIFEST.sha256 carries its sha256 in a format both
`sha256sum -c` (Linux) and `shasum -a 256 -c` (macOS) verify. Scope is exactly
`git ls-files`, so regenerating after any accepted change is one command:

    python3 tools/make_manifests.py

RELEASE_MANIFEST.sha256 itself is the one exclusion: a file cannot contain its
own hash and still verify, so its entry would fail on every check.
"""
from __future__ import annotations

import hashlib
import subprocess
import sys

RELEASE = "RELEASE_MANIFEST.sha256"
SOURCES = "SOURCE_MANIFEST.txt"


def tracked() -> list[str]:
    raw = subprocess.run(["git", "ls-files", "-z"], capture_output=True, check=True).stdout
    files = sorted(f for f in raw.decode("utf-8", "replace").split("\0") if f)
    if not files:
        sys.exit("git ls-files returned nothing; run this from the repository root")
    return files


def main() -> int:
    files = tracked()
    with open(SOURCES, "w", encoding="utf-8") as out:
        out.write("\n".join(files) + "\n")

    with open(RELEASE, "w", encoding="utf-8") as out:
        for name in files:
            if name == RELEASE:
                continue  # a self-hash can never verify
            digest = hashlib.sha256()
            with open(name, "rb") as fh:
                for block in iter(lambda: fh.read(1 << 20), b""):
                    digest.update(block)
            # The ./ prefix matches the original manifest's format; both checkers accept it.
            out.write(f"{digest.hexdigest()}  ./{name}\n")

    written = len(files) - 1  # RELEASE_MANIFEST itself is excluded
    print(f"{SOURCES}: {len(files)} files")
    print(f"{RELEASE}: {written} entries")
    return 0


if __name__ == "__main__":
    sys.exit(main())
