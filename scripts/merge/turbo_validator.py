import json
from pathlib import Path


def validate_turbo():
    config = json.loads(Path("turbo.json").read_text())
    tasks = config.get("tasks")
    if not isinstance(tasks, dict):
        tasks = config.get("pipeline", {})

    if "build" not in tasks:
        raise Exception("Turbo build pipeline missing")
