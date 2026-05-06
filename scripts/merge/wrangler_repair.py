from pathlib import Path
import toml


def repair_wrangler():
    for file in Path(".").rglob("wrangler.toml"):
        config = toml.loads(file.read_text())
        if "env" not in config:
            config["env"] = {}
        if "prod" not in config["env"]:
            config["env"]["prod"] = {
                "compatibility_date": "2026-02-24"
            }
        file.write_text(toml.dumps(config))
