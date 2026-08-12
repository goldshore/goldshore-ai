#!/usr/bin/env python3
"""Export a read-only Cloudflare account inventory for retirement review."""

from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.cloudflare.com/client/v4"
ACCOUNT = os.environ["CLOUDFLARE_ACCOUNT_ID"]
TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
OUT = pathlib.Path(os.environ.get("CF_DISCOVERY_OUTPUT", "cloudflare-discovery"))
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
ERRORS: list[dict] = []


def request(path: str, *, params: dict | None = None, data: dict | None = None):
    url = f"{API}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url, headers=HEADERS, data=json.dumps(data).encode() if data is not None else None,
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            body = json.load(response)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
        detail = exc.read().decode(errors="replace") if isinstance(exc, urllib.error.HTTPError) else str(exc)
        ERRORS.append({"path": path, "error": detail[:1000]})
        return None
    if not body.get("success", True) or body.get("result") is None:
        ERRORS.append({"path": path, "error": body.get("errors", body)})
        return None
    return body.get("result")


def paged(path: str, *, params: dict | None = None) -> list:
    values, page = [], 1
    while True:
        query = {**(params or {}), "page": page, "per_page": 100}
        url = f"{API}{path}?{urllib.parse.urlencode(query)}"
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=45) as response:
                body = json.load(response)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            detail = exc.read().decode(errors="replace") if isinstance(exc, urllib.error.HTTPError) else str(exc)
            ERRORS.append({"path": path, "error": detail[:1000]})
            return values
        result = body.get("result")
        if result is None:
            ERRORS.append({"path": path, "error": body.get("errors", body)})
            return values
        values.extend(result if isinstance(result, list) else [result])
        info = body.get("result_info") or {}
        if page >= info.get("total_pages", 1) or not result:
            return values
        page += 1


def settings(worker: str) -> dict:
    result = request(f"/accounts/{ACCOUNT}/workers/scripts/{urllib.parse.quote(worker)}/settings")
    return result if isinstance(result, dict) else {}


def volume(worker: str) -> dict:
    end = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    start = end - dt.timedelta(days=7)
    query = """query($account:String!,$script:String!,$start:Time!,$end:Time!){viewer{accounts(filter:{accountTag:$account}){workersInvocationsAdaptive(limit:1,filter:{scriptName:$script,datetime_geq:$start,datetime_leq:$end}){sum{requests errors}}}}}"""
    result = request("/graphql", data={"query": query, "variables": {
        "account": ACCOUNT, "script": worker, "start": start.isoformat(), "end": end.isoformat()
    }})
    try:
        sums = result["viewer"]["accounts"][0]["workersInvocationsAdaptive"][0]["sum"]
    except (TypeError, KeyError, IndexError):
        sums = {"requests": None, "errors": None}
    return {"window_start": start.isoformat(), "window_end": end.isoformat(), **sums}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    account_path = f"/accounts/{ACCOUNT}"
    workers = paged(f"{account_path}/workers/scripts")
    zones = paged("/zones", params={"account.id": ACCOUNT})
    zone_routes, email_routes = [], []
    for zone in zones:
        zid = zone["id"]
        for route in paged(f"/zones/{zid}/workers/routes"):
            zone_routes.append({"zone": zone.get("name"), **route})
        for route in paged(f"/zones/{zid}/email/routing/rules"):
            email_routes.append({"zone": zone.get("name"), **route})

    detail = {}
    service_incoming: dict[str, list] = {}
    for worker in workers:
        name = worker["id"]
        config = settings(name)
        bindings = config.get("bindings", [])
        for binding in bindings:
            if binding.get("type") == "service" and binding.get("service"):
                service_incoming.setdefault(binding["service"], []).append({
                    "source": name, "binding": binding.get("name"), "environment": binding.get("environment")
                })
        detail[name] = {
            "metadata": worker,
            "versions": paged(f"{account_path}/workers/scripts/{urllib.parse.quote(name)}/versions"),
            "routes": [r for r in zone_routes if r.get("script") == name],
            "custom_domains": [],
            "bindings": bindings,
            "secret_names": sorted(b.get("name") for b in bindings if b.get("type") in {"secret_text", "secret_key"}),
            "cron_triggers": request(f"{account_path}/workers/scripts/{urllib.parse.quote(name)}/schedules") or [],
            "request_volume_7d": volume(name),
        }

    custom_domains = paged(f"{account_path}/workers/domains")
    for domain in custom_domains:
        service = domain.get("service")
        if service in detail:
            detail[service]["custom_domains"].append(domain)

    queues = paged(f"{account_path}/queues")
    consumers = {}
    for queue in queues:
        qid = queue.get("queue_id") or queue.get("id")
        consumers[queue.get("queue_name") or queue.get("name") or qid] = paged(f"{account_path}/queues/{qid}/consumers")

    access_apps = paged(f"{account_path}/access/apps")
    idps = paged(f"{account_path}/access/identity_providers")
    pages = paged(f"{account_path}/pages/projects")
    pages_detail = {}
    for project in pages:
        name = project["name"]
        deployments = paged(f"{account_path}/pages/projects/{urllib.parse.quote(name)}/deployments")
        pages_detail[name] = {"project": project, "deployments": deployments[:10]}

    inventory = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "account_id": ACCOUNT,
        "workers": detail,
        "worker_routes": zone_routes,
        "custom_domains": custom_domains,
        "pages_projects": pages_detail,
        "kv_namespaces": paged(f"{account_path}/storage/kv/namespaces"),
        "d1_databases": paged(f"{account_path}/d1/database"),
        "r2_buckets": paged(f"{account_path}/r2/buckets"),
        "queues": queues,
        "queue_consumers": consumers,
        "email_routes": email_routes,
        "workflows": paged(f"{account_path}/workflows"),
        "pipelines": paged(f"{account_path}/pipelines"),
        "durable_objects": paged(f"{account_path}/workers/durable_objects/namespaces"),
        "access_apps": access_apps,
        "identity_providers": idps,
        "errors": ERRORS,
    }
    for name, worker in detail.items():
        worker["incoming_service_bindings"] = service_incoming.get(name, [])

    (OUT / "inventory.json").write_text(json.dumps(inventory, indent=2, sort_keys=True) + "\n")
    write_review(inventory)
    print(f"Exported Cloudflare discovery to {OUT}")
    if ERRORS:
        print(f"WARNING: {len(ERRORS)} endpoint(s) were unavailable; see inventory.json", file=sys.stderr)
    return 0


def write_review(inv: dict) -> None:
    canonical = {"gs-api-prod", "gs-api-preview", "gs-web-prod", "gs-web-preview"}
    legacy = ("gs-agent", "gs-admin", "gs-control", "gs-core", "gs-cron", "gs-gateway", "gs-mail", "gs-platform", "gs-signals", "gs-trading", "gs-www-redirect")
    access_by_domain = {a.get("domain"): a.get("name") for a in inv["access_apps"]}
    lines = ["# Cloudflare ambiguity review", "", f"Generated: {inv['generated_at']}", "",
             "> Classification is evidence for human review, not deletion authorization. Unknown ownership is never inferred from an unused-looking name.", "",
             "| Asset | Classification | Source repository | Latest deploy time / SHA | Routes and domains | Incoming bindings | Queues / email / cron | Access app | Requests (7d) |", "|---|---|---|---|---|---|---|---|---|"]
    for name, item in sorted(inv["workers"].items()):
        bindings = item["bindings"]
        repo = next((b.get("repository") or b.get("text") for b in bindings if b.get("name") in {"CF_PAGES_URL", "SOURCE_REPOSITORY"}), None)
        versions = item["versions"]
        latest = versions[0] if versions else {}
        sha = ((latest.get("annotations") or {}).get("workers/message") or (latest.get("metadata") or {}).get("source"))
        routes = [r.get("pattern") for r in item["routes"]] + [d.get("hostname") for d in item["custom_domains"]]
        incoming = item["incoming_service_bindings"]
        queue_names = [b.get("queue_name") for b in bindings if b.get("type") == "queue"]
        email = any(b.get("type") == "send_email" for b in bindings)
        access = sorted({access_by_domain.get(r.split("/")[0]) for r in routes if access_by_domain.get(r.split("/")[0])})
        req = item["request_volume_7d"].get("requests")
        if name in canonical:
            classification = "canonical"
        elif repo and "goldshore-ai" not in str(repo):
            classification = "external-owned"
        elif name.startswith(legacy):
            classification = "migration source" if req not in (0, None) or incoming or routes or queue_names or email or item["cron_triggers"] else "retirement candidate"
        else:
            classification = "external-owned (ownership unverified)"
        cells = [name, classification, repo or "unknown", f"{latest.get('created_on') or item['metadata'].get('modified_on') or 'unknown'} / {sha or 'unknown'}", ", ".join(filter(None, routes)) or "none observed", json.dumps(incoming) if incoming else "none observed", f"queues={queue_names or 'none'}; email={email}; cron={len(item['cron_triggers'])}", ", ".join(access) or "none observed", str(req) if req is not None else "unavailable"]
        lines.append("| " + " | ".join(str(c).replace("|", "\\|").replace("\n", " ") for c in cells) + " |")
    for name, item in sorted(inv["pages_projects"].items()):
        project = item["project"]
        deployments = item["deployments"]
        latest = deployments[0] if deployments else {}
        source = project.get("source") or latest.get("source") or {}
        repo = source.get("config", {}).get("repo_name") or "unknown"
        sha = latest.get("deployment_trigger", {}).get("metadata", {}).get("commit_hash") or "unknown"
        domains = project.get("domains") or [project.get("subdomain")]
        classification = "external-owned" if repo != "unknown" and repo != "goldshore-ai" else "migration source"
        cells = [f"Pages: {name}", classification, repo,
                 f"{latest.get('created_on', 'unknown')} / {sha}", ", ".join(filter(None, domains)) or "none observed",
                 "n/a", "n/a", ", ".join(filter(None, (access_by_domain.get(d) for d in domains))) or "none observed", "unavailable"]
        lines.append("| " + " | ".join(str(c).replace("|", "\\|").replace("\n", " ") for c in cells) + " |")
    lines += ["", "## Mandatory retirement gate", "", "1. Obtain human confirmation of ownership and classification.", "2. Remove incoming routes, custom domains, service bindings, queue consumers, email handlers, and cron triggers only in an approved preview/change window.", "3. Monitor request/error volume and dependent services for failures.", "4. Retain the last known-good Worker version and back up attached KV, D1, R2, queue, and Durable Object data as applicable.", "5. Obtain explicit human approval before deletion; never repurpose an unknown Worker.", ""]
    (OUT / "ambiguity-review.md").write_text("\n".join(lines))


if __name__ == "__main__":
    raise SystemExit(main())
