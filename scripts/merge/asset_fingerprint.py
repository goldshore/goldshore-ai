import hashlib, shutil
from pathlib import Path


def fingerprint_asset(path):
    data = Path(path).read_bytes()
    h = hashlib.sha256(data).hexdigest()[:8]
    ext = Path(path).suffix
    name = Path(path).stem.lower().replace(" ", "-")
    new_name = f"{name}-{h}{ext}"
    dest = Path("public/assets") / new_name
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)
    return str(dest)
