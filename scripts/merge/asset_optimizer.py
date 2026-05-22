from pathlib import Path
from PIL import Image


def optimize_images():
    for img in Path("public/assets").rglob("*"):
        if img.suffix.lower() in [".png", ".jpg", ".jpeg"]:
            im = Image.open(img)
            im.save(img, optimize=True, quality=85)
