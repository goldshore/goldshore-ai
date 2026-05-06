import json
from pathlib import Path


def deep_merge(a, b):
    for k, v in b.items():
        if k in a and isinstance(a[k], dict) and isinstance(v, dict):
            deep_merge(a[k], v)
        else:
            if k not in a:
                a[k] = v
    return a


def deep_merge_json(target_path, legacy_path):
    target = json.loads(Path(target_path).read_text())
    legacy = json.loads(Path(legacy_path).read_text())
    merged = deep_merge(target, legacy)
    Path(target_path).write_text(json.dumps(merged, indent=2))
