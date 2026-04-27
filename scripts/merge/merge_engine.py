import os, shutil, hashlib, json, argparse
from pathlib import Path
from datetime import datetime
from json_merge import deep_merge_json
from workflow_dedupe import merge_workflows

SKIP_LEGACY_DIRS = {
    ".git",
    ".hg",
    ".svn",
    "__pycache__",
}


EXCLUDED_DIRS = {".git", ".hg", ".svn", "__pycache__"}


EXCLUDED_DIRS = {".git", ".hg", ".svn", "__pycache__"}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


def ensure_dir(p):
    Path(p).parent.mkdir(parents=True, exist_ok=True)


def copy_file(src, dest):
    ensure_dir(dest)
    shutil.copy2(src, dest)


def archive_legacy(src_root, archive_root):
    if Path(archive_root).exists():
        return
    shutil.copytree(src_root, archive_root)


def handle_file(src, dest, report, mode):
    if not dest.exists():
        if mode == "apply":
            copy_file(src, dest)
        report["copied"].append(str(dest))
        return

    if dest.is_dir():
        report["conflicts"].append(f"{dest} (file-vs-directory)")
        return

    if sha256(src) == sha256(dest):
        report["identical"].append(str(dest))
        return

    if src.suffix == ".json":
        if mode == "apply":
            deep_merge_json(dest, src)
        report["json_merged"].append(str(dest))
        return

    if ".github/workflows" in str(dest):
        if mode == "apply":
            merge_workflows(dest, src)
        report["workflow_merged"].append(str(dest))
        return

    report["conflicts"].append(str(dest))


def run(target, legacy, archive, mode):
    report = {
        "timestamp": datetime.utcnow().isoformat(),
        "mode": mode,
        "copied": [],
        "identical": [],
        "json_merged": [],
        "workflow_merged": [],
        "conflicts": [],
    }

    legacy = Path(legacy)
    target = Path(target)

    mutate = mode == "apply"

    for root, dirs, files in os.walk(legacy):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for f in files:
            src = Path(root) / f
            rel = src.relative_to(legacy)
            dest = target / rel
            handle_file(src, dest, report, mode)

    if mutate:
        archive_legacy(legacy, target / archive)

    Path("reports/merge").mkdir(parents=True, exist_ok=True)
    with open("reports/merge/merge-report.json", "w") as r:
        json.dump(report, r, indent=2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True)
    parser.add_argument("--legacy", required=True)
    parser.add_argument("--archive", required=True)
    parser.add_argument("--mode", choices=["plan", "apply"], required=True)
    args = parser.parse_args()
    run(args.target, args.legacy, args.archive, args.mode)
