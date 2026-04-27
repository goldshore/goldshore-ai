import os
import shutil
from datetime import datetime

SOURCE_REPO = "/tmp/goldshore-github-io"
DEST_ROOT = "apps/gs-web/legacy"
ALLOWED_EXTS = {".png", ".jpg", ".jpeg", ".svg", ".webp", ".html", ".md", ".css"}
IGNORED_DIRS = {".git", "node_modules", "dist", ".turbo", ".idea", ".vscode", "workflows"}
IGNORED_FILES = {"package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "astro.config.mjs", "tsconfig.json", "wrangler.toml"}

# Mapping rules (extension -> folder)
EXT_MAPPING = {
    ".css": "styles",
    ".md": "docs",
    ".html": "fragments",
    ".png": "assets",
    ".jpg": "assets",
    ".jpeg": "assets",
    ".svg": "assets",
    ".webp": "assets"
}

def get_dest_folder(filename):
    ext = os.path.splitext(filename)[1].lower()
    return EXT_MAPPING.get(ext, "misc")

def migrate():
    if not os.path.exists(SOURCE_REPO):
        print(f"Source repo {SOURCE_REPO} not found. Skipping migration execution.")
        print("Please clone the repository to /tmp/goldshore-github-io and run this script manually.")
        return

    migrated_count = 0

    print(f"Starting migration from {SOURCE_REPO} to {DEST_ROOT}...")

    for root, dirs, files in os.walk(SOURCE_REPO):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]

        for file in files:
            if file in IGNORED_FILES:
                continue

            ext = os.path.splitext(file)[1].lower()
            if ext not in ALLOWED_EXTS:
                continue

            source_path = os.path.join(root, file)

            # Determine destination category
            category = get_dest_folder(file)
            dest_dir = os.path.join(DEST_ROOT, category)

            if not os.path.exists(dest_dir):
                os.makedirs(dest_dir)

            dest_path = os.path.join(dest_dir, file)

            if os.path.exists(dest_path):
                # Conflict! Rename to legacy
                base, ext = os.path.splitext(file)
                # Try simple legacy suffix
                new_name = f"{base}-legacy{ext}"
                dest_path = os.path.join(dest_dir, new_name)

                # If that also exists, add timestamp
                if os.path.exists(dest_path):
                     timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
                     new_name = f"{base}-legacy-{timestamp}{ext}"
                     dest_path = os.path.join(dest_dir, new_name)

            try:
                shutil.copy2(source_path, dest_path)
                print(f"Migrated: {file} -> {category}/{os.path.basename(dest_path)}")
                migrated_count += 1
            except Exception as e:
                print(f"Error copying {file}: {e}")

    print(f"Migration complete. {migrated_count} files moved.")

if __name__ == "__main__":
    migrate()
