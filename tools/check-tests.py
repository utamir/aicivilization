#!/usr/bin/env python3
"""Compare a vitest JSON report against the known-failing list.

Exit 0 when the failures are exactly (or a subset of) the ones recorded in
tools/known-test-failures.txt; exit 1 on any new failure, on a suite that could
not run at all, or on a report that is missing or unreadable. A known failure
that starts passing is a warning, not an error: the build should not break
because something got fixed, but the stale line wants removing.
"""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
KNOWN_FILE = ROOT / "tools" / "known-test-failures.txt"


def load_known() -> set[str]:
    if not KNOWN_FILE.is_file():
        return set()
    lines = KNOWN_FILE.read_text(encoding="utf-8").splitlines()
    return {l.strip() for l in lines if l.strip() and not l.lstrip().startswith("#")}


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} <vitest-json-report>", file=sys.stderr)
        return 1
    report = pathlib.Path(sys.argv[1])
    if not report.is_file():
        print(f"::error::vitest wrote no report at {report}; the suite did not run",
              file=sys.stderr)
        return 1
    try:
        data = json.loads(report.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"::error::vitest report at {report} is not valid JSON: {e}", file=sys.stderr)
        return 1

    total = data.get("numTotalTests", 0)
    if not total:
        print("::error::the vitest report contains no tests at all", file=sys.stderr)
        return 1

    failed: set[str] = set()
    messages: dict[str, str] = {}
    for suite in data.get("testResults", []):
        assertions = suite.get("assertionResults", [])
        for a in assertions:
            if a.get("status") == "failed":
                name = a.get("fullName", "").strip()
                failed.add(name)
                messages[name] = "\n".join(a.get("failureMessages", []))
        # A suite that blew up on import reports no assertions at all.
        if suite.get("status") == "failed" and not any(
            a.get("status") == "failed" for a in assertions
        ):
            name = suite.get("name", "(unknown file)")
            print(f"::error::test file failed without running its tests: {name}",
                  file=sys.stderr)
            print((suite.get("message") or "").strip()[:2000], file=sys.stderr)
            return 1

    known = load_known()
    new = sorted(failed - known)
    fixed = sorted(known - failed)

    print(f"{total} tests, {len(failed)} failing, {len(known)} known-failing")

    for name in fixed:
        print(f"::warning::known-failing test now passes, remove it from "
              f"{KNOWN_FILE.relative_to(ROOT)}: {name}")

    if new:
        for name in new:
            print(f"::error::new test failure: {name}", file=sys.stderr)
            detail = messages.get(name, "").strip()
            if detail:
                for line in detail.splitlines()[:12]:
                    print(f"    {line}", file=sys.stderr)
        print(f"\n{len(new)} new failure(s) beyond the {len(known)} known ones.",
              file=sys.stderr)
        return 1

    if failed:
        print(f"only known failures ({len(failed)}); treating the suite as green")
    else:
        print("no failures at all")
    return 0


if __name__ == "__main__":
    sys.exit(main())
