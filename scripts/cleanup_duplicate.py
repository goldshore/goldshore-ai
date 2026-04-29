import os
import shutil
from datetime import datetime

NESTED_ROOT = "astro-goldshore"
ROOT_DIR = "."
DATE_SUFFIX = datetime.now().strftime("%Y%m%d")

IGNORED_DIRS = {".git", "node_modules", "dist", ".turbo", ".idea", ".vscode"}
IGNORED_FILES = {"pnpm-lock.yaml", "package-lock.json", "yarn.lock"}

def get_file_mtime(filepath):
    return os.path.getmtime(filepath)

def process_nested_folder():
    if not os.path.exists(NESTED_ROOT):
        print(f"Nested root {NESTED_ROOT} does not exist. Nothing to do.")
        return

    moved_files = []
    deleted_files = []
    legacy_files = []

    for root, dirs, files in os.walk(NESTED_ROOT, topdown=True):
        # Modify dirs in-place to skip ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]

        for file in files:
            if file in IGNORED_FILES:
                continue

            nested_path = os.path.join(root, file)
            # Calculate relative path from NESTED_ROOT
            rel_path = os.path.relpath(nested_path, NESTED_ROOT)
            target_path = os.path.join(ROOT_DIR, rel_path)

            # Ensure target directory exists
            target_dir = os.path.dirname(target_path)

            if not os.path.exists(target_path):
                # Case 1: File does not exist in root -> MOVE
                if not os.path.exists(target_dir):
                    os.makedirs(target_dir)
                shutil.move(nested_path, target_path)
                moved_files.append(f"{rel_path} (Unique)")
                print(f"MOVED (Unique): {nested_path} -> {target_path}")
            else:
                # File exists in both places. Compare timestamps.
                nested_mtime = get_file_mtime(nested_path)
                target_mtime = get_file_mtime(target_path)

                # Using a small epsilon for float comparison if needed, but strict is fine
                if target_mtime >= nested_mtime:
                    # Case 2: Root is newer or same -> DELETE nested
                    os.remove(nested_path)
                    deleted_files.append(rel_path)
                    print(f"DELETED (Root newer/same): {nested_path}")
                else:
                    # Case 3: Nested is newer -> RENAME & MOVE
                    # Construct legacy name: filename.legacy-YYYYMMDD.ext
                    base, ext = os.path.splitext(file)
                    new_filename = f"{base}.legacy-{DATE_SUFFIX}{ext}"
                    new_target_path = os.path.join(target_dir, new_filename)

                    if not os.path.exists(target_dir):
                         os.makedirs(target_dir)

                    shutil.move(nested_path, new_target_path)
                    legacy_files.append(f"{rel_path} -> {new_filename}")
                    print(f"MOVED (Legacy): {nested_path} -> {new_target_path}")

    # After processing all files, try to remove the NESTED_ROOT directory
    # It might fail if not empty (e.g. ignored dirs left), so we use shutil.rmtree
    print(f"Removing {NESTED_ROOT}...")
    try:
        shutil.rmtree(NESTED_ROOT)
        print("Cleanup complete.")
    except Exception as e:
        print(f"Error removing {NESTED_ROOT}: {e}")

    # Generate Summary
    summary = f"""
# Duplicate Cleanup Summary
- **Unique Files Moved:** {len(moved_files)}
- **Duplicate Files Deleted:** {len(deleted_files)}
- **Newer Nested Files Preserved (Legacy):** {len(legacy_files)}

## Details
### Moved
{chr(10).join(['- ' + f for f in moved_files])}

### Preserved as Legacy
{chr(10).join(['- ' + f for f in legacy_files])}
    """

    with open("cleanup_summary.md", "w") as f:
        f.write(summary)
    print("Summary written to cleanup_summary.md")

if __name__ == "__main__":
    process_nested_folder()
