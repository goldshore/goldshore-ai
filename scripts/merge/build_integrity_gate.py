import subprocess


def run_build_checks():
    subprocess.run(["pnpm", "-w", "install"], check=True)
    subprocess.run(["pnpm", "-C", "apps/gs-web", "build"], check=True)
    subprocess.run(["pnpm", "-C", "apps/gs-admin", "build"], check=True)
