import yaml
from pathlib import Path


def merge_workflows(target_path, legacy_path):
    t = yaml.safe_load(Path(target_path).read_text())
    l = yaml.safe_load(Path(legacy_path).read_text())

    if "jobs" in l:
        for job, config in l["jobs"].items():
            if job not in t.get("jobs", {}):
                t.setdefault("jobs", {})[job] = config

    Path(target_path).write_text(yaml.dump(t, sort_keys=False))
