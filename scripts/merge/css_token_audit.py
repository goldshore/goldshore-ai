import re
from pathlib import Path

TOKEN_PATTERN = re.compile(r"--gs-[a-z0-9\-]+")


def collect_tokens(path):
    tokens = set()
    for file in Path(path).rglob("*.css"):
        text = file.read_text()
        tokens.update(TOKEN_PATTERN.findall(text))
    return tokens


def detect_collisions(target, legacy):
    t = collect_tokens(target)
    l = collect_tokens(legacy)
    collisions = t.intersection(l)
    if collisions:
        report = Path("reports/merge/css-token-collisions.txt")
        report.write_text("\n".join(collisions))
