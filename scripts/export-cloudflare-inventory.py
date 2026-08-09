#!/usr/bin/env python3
"""Export the repository's redacted Cloudflare expected-state inventory."""

import json
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFESTS = [ROOT / "apps/gs-web/wrangler.toml", ROOT / "apps/gs-api/wrangler.toml"]


def collect(value, key, output):
    if isinstance(value, dict):
        if key in value:
            candidate = value[key]
            output.extend(candidate if isinstance(candidate, list) else [candidate])
        for child in value.values():
            collect(child, key, output)
    elif isinstance(value, list):
        for child in value:
            collect(child, key, output)


def manifest_inventory(path):
    text = path.read_text(encoding="utf-8")
    data = tomllib.loads(text)
    routes, bindings = [], set()
    collect(data, "routes", routes)
    for key in ("kv_namespaces", "d1_databases", "r2_buckets", "services", "producers", "consumers", "workflows"):
        entries = []
        collect(data, key, entries)
        for entry in entries:
            if isinstance(entry, dict) and entry.get("binding"):
                bindings.add(entry["binding"])
    for section in ("ai", "images", "assets"):
        entries = []
        collect(data, section, entries)
        for entry in entries:
            if isinstance(entry, dict) and entry.get("binding"):
                bindings.add(entry["binding"])
    route_patterns = sorted({r.get("pattern") for r in routes if isinstance(r, dict) and r.get("pattern")})
    secret_names = sorted(set(re.findall(r"\b([A-Z][A-Z0-9_]*(?:SECRET|TOKEN|API_KEY|MASTER_KEY|SENDER_EMAIL))\b", text)))
    return {
        "manifest": str(path.relative_to(ROOT)),
        "worker": data.get("name"),
        "binding_names": sorted(bindings),
        "route_ownership": route_patterns,
        "secret_names": secret_names,
    }


def main():
    dashboard = json.loads((ROOT / "infra/Cloudflare/dashboard-inventory.json").read_text(encoding="utf-8"))
    result = {
        "notice": "Names and IDs only; secret values and policy details are intentionally excluded.",
        "authority": "apps/gs-web/wrangler.toml and apps/gs-api/wrangler.toml",
        "workers": [manifest_inventory(path) for path in MANIFESTS],
        "dashboard_only": dashboard,
    }
    destination = Path(sys.argv[1] if len(sys.argv) > 1 else "cloudflare-inventory.json")
    destination.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(destination)


if __name__ == "__main__":
    main()
