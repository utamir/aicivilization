#!/usr/bin/env python3
"""Trigger an xhostd deploy over MCP and wait for it to finish.

Pushing to the app's git repo only stores code; a deploy call is what builds
and ships it. This speaks JSON-RPC over the Streamable HTTP MCP transport at
https://mcp.xhostd.com/mcp/ using a platform token (XHOST_TOKEN, `xh_...`),
which is the only credential the server accepts without a browser: its OAuth
metadata advertises authorization_code and refresh_token, no client_credentials.

Stdlib only, so CI needs nothing installed.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

PROTOCOL = "2025-06-18"
STATUSES = ("success", "failed", "running", "queued")


class McpError(RuntimeError):
    pass


class Mcp:
    """Minimal Streamable-HTTP MCP client: initialize, tools/list, tools/call."""

    def __init__(self, url: str, token: str, client: str = "civ-ci"):
        self.url = url
        self.token = token
        self.client = client
        self.session: str | None = None
        self._id = 0

    def _post(self, payload: dict) -> dict | None:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": f"Bearer {self.token}",
            "MCP-Protocol-Version": PROTOCOL,
        }
        if self.session:
            headers["Mcp-Session-Id"] = self.session
        req = urllib.request.Request(
            self.url, data=json.dumps(payload).encode(), headers=headers, method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                sid = r.headers.get("Mcp-Session-Id")
                if sid:
                    self.session = sid
                ctype = r.headers.get("Content-Type", "")
                raw = r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace").strip()[:500]
            raise McpError(f"HTTP {e.code} from {self.url}: {body or e.reason}") from None
        except urllib.error.URLError as e:
            raise McpError(f"cannot reach {self.url}: {e.reason}") from None

        if not raw.strip():
            return None  # notifications answer 202 with no body

        messages = []
        if "text/event-stream" in ctype:
            for line in raw.splitlines():
                if line.startswith("data:"):
                    try:
                        messages.append(json.loads(line[5:].strip()))
                    except json.JSONDecodeError:
                        pass
        else:
            messages.append(json.loads(raw))

        want = payload.get("id")
        for m in messages:
            if isinstance(m, dict) and m.get("id") == want:
                return m
        return messages[-1] if messages else None

    def request(self, method: str, params: dict | None = None) -> dict:
        self._id += 1
        payload = {"jsonrpc": "2.0", "id": self._id, "method": method}
        if params is not None:
            payload["params"] = params
        msg = self._post(payload)
        if msg is None:
            raise McpError(f"empty response to {method}")
        if "error" in msg:
            raise McpError(f"{method} failed: {json.dumps(msg['error'])}")
        return msg.get("result", {})

    def notify(self, method: str, params: dict | None = None) -> None:
        payload = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            payload["params"] = params
        self._post(payload)

    def connect(self) -> dict:
        info = self.request(
            "initialize",
            {
                "protocolVersion": PROTOCOL,
                "capabilities": {},
                "clientInfo": {"name": self.client, "version": "1"},
            },
        )
        self.notify("notifications/initialized")
        return info

    def call(self, name: str, arguments: dict) -> dict:
        result = self.request("tools/call", {"name": name, "arguments": arguments})
        if result.get("isError"):
            raise McpError(f"{name}: {text_of(result) or 'tool reported an error'}")
        return result


def text_of(result: dict) -> str:
    parts = [
        c.get("text", "")
        for c in result.get("content", [])
        if isinstance(c, dict) and c.get("type") == "text"
    ]
    return "\n".join(parts).strip()


def data_of(result: dict) -> dict:
    """The tool's structured payload, however this server chose to send it."""
    structured = result.get("structuredContent")
    if isinstance(structured, dict) and structured:
        return structured
    try:
        parsed = json.loads(text_of(result))
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def build_args(schema: dict, values: dict, defaults: dict | None = None) -> tuple[dict, list[str]]:
    """Fill a tool's arguments from the inputSchema the server itself advertised,
    so a renamed or extended API is adapted to rather than guessed at."""
    props = schema.get("properties", {}) if isinstance(schema, dict) else {}
    defaults = defaults or {}
    args: dict = {}
    for name, spec in props.items():
        if name in values:
            args[name] = values[name]
        elif name in defaults:
            args[name] = defaults[name]
        elif isinstance(spec, dict) and isinstance(spec.get("enum"), list):
            # An unrecognised enum selector: pass a value matching our purpose if one exists.
            for cand in spec["enum"]:
                if isinstance(cand, str) and "deploy" in cand.lower():
                    args[name] = cand
                    break
    missing = [r for r in schema.get("required", []) if r not in args]
    return args, missing


def status_in(line: str) -> str | None:
    return next((s for s in STATUSES if re.search(rf"\b{s}\b", line, re.I)), None)


def gh_error(msg: str) -> None:
    """Surface the failure as a step annotation: job logs need admin rights to
    read, but annotations show for everyone in the checks UI."""
    for line in msg.splitlines() or ["(no detail)"]:
        print(f"::error::{line}", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--app", required=True, help="xhostd app name, e.g. civ")
    ap.add_argument("--channel", default="prod")
    ap.add_argument("--ref", default="master", help="branch to deploy; resolved to its HEAD")
    ap.add_argument("--url", default=os.environ.get("XHOST_MCP_URL", "https://mcp.xhostd.com/mcp/"))
    ap.add_argument("--timeout", type=int, default=900, help="seconds to wait for the deploy")
    ap.add_argument("--poll", type=float, default=5.0)
    ns = ap.parse_args()

    token = os.environ.get("XHOST_TOKEN", "").strip()
    if not token:
        print(
            "XHOST_TOKEN is not set. Create a token at https://console.xhostd.com "
            "and store it as a repository secret.",
            file=sys.stderr,
        )
        return 2

    mcp = Mcp(ns.url, token)
    try:
        info = mcp.connect()
        server = info.get("serverInfo", {})
        print(f"connected: {server.get('name', 'mcp')} {server.get('version', '')}".rstrip())

        # Fail loudly with the real tool list rather than guessing at names.
        tools = {t.get("name"): t for t in mcp.request("tools/list").get("tools", [])}
        log_tool = next((n for n in ("get_deploy_log", "get_logs") if n in tools), None)
        if "deploy" not in tools or log_tool is None:
            missing = sorted({"deploy", "get_deploy_log", "get_logs"} - set(tools))
            gh_error(f"server does not expose {missing} (deploy tool and a log tool are required); "
                     f"it offers: {sorted(n for n in tools if n)}")
            return 1

        def schema_of(name: str) -> dict:
            return tools[name].get("inputSchema") or {}

        started = data_of(
            mcp.call("deploy", {"app_name": ns.app, "channel": ns.channel, "ref": ns.ref})
        )
        deploy_id = started.get("deploy_id")
        if not deploy_id:
            # Retry with the exact argument names the server's own schema asks for.
            args, unfilled = build_args(
                schema_of("deploy"),
                {"app_name": ns.app, "app": ns.app, "channel": ns.channel,
                 "ref": ns.ref, "branch": ns.ref, "environment": ns.channel},
            )
            if unfilled:
                gh_error(f"deploy schema requires {unfilled}, which this script does not supply")
                return 1
            started = data_of(mcp.call("deploy", args))
            deploy_id = started.get("deploy_id") or started.get("deployId") or started.get("id")
        if not deploy_id:
            gh_error(f"deploy returned no deploy_id: {started or '(no structured payload)'}")
            return 1
        print(f"deploy {deploy_id} queued: {ns.app}/{ns.channel} @ {ns.ref}")

        deadline = time.time() + ns.timeout
        last_line = ""
        while True:
            log_args, unfilled = build_args(
                schema_of(log_tool),
                {"app_name": ns.app, "app": ns.app, "channel": ns.channel,
                 "deploy_id": deploy_id, "deployId": deploy_id, "id": deploy_id,
                 "ref": ns.ref, "branch": ns.ref},
                {"limit": 100, "tail": 100, "lines": 100},
            )
            if unfilled:
                gh_error(f"{log_tool} schema requires {unfilled}, which this script does not supply")
                return 1
            result = mcp.call(log_tool, log_args)
            data = data_of(result)
            log = text_of(result)
            # The status may arrive as a structured field, the log's first line,
            # or its last line - accept each in that order.
            status = None
            for key in ("status", "state", "phase"):
                v = data.get(key)
                if isinstance(v, str) and v.lower() in STATUSES:
                    status = v.lower()
                    break
            lines = [ln for ln in log.splitlines() if ln.strip()] if log else []
            first = lines[0] if lines else ""
            if status is None:
                for line in ([first, lines[-1]] if len(lines) > 1 else [first]):
                    status = status_in(line)
                    if status:
                        break
            if first and first != last_line:
                print(first, flush=True)
                last_line = first

            if status == "success":
                print("deploy succeeded")
                return 0
            if status == "failed":
                gh_error(f"deploy {deploy_id} failed")
                print("--- deploy log ---", file=sys.stderr)
                print(log, file=sys.stderr)
                return 1
            if time.time() >= deadline:
                gh_error(f"timed out after {ns.timeout}s waiting for deploy {deploy_id}; "
                         f"last status line: {first or '(none)'}")
                print("--- deploy log ---", file=sys.stderr)
                print(log, file=sys.stderr)
                return 1
            time.sleep(ns.poll)

    except McpError as e:
        gh_error(f"xhostd deploy failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
