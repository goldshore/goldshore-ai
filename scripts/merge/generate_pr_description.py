import json
from pathlib import Path

report = json.loads(Path("reports/merge/merge-report.json").read_text())

description = f"""
## Migration Summary

Copied: {len(report["copied"])}
JSON Merged: {len(report["json_merged"])}
Workflow Merged: {len(report["workflow_merged"])}
Identical Skipped: {len(report["identical"])}
Conflicts: {len(report["conflicts"])}

Conflicts require manual review.
"""

Path("reports/merge/pr-description.md").write_text(description)
