import difflib
from pathlib import Path


def semantic_merge(target_path, legacy_path):
    target = Path(target_path).read_text().splitlines()
    legacy = Path(legacy_path).read_text().splitlines()

    diff = list(difflib.unified_diff(target, legacy, lineterm=""))

    conflict_file = Path("reports/merge/conflicts") / (Path(target_path).name + ".semantic.diff")
    conflict_file.parent.mkdir(parents=True, exist_ok=True)
    conflict_file.write_text("\n".join(diff))

    return False  # manual resolution required
