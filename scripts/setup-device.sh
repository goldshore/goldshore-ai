#!/usr/bin/env bash
# setup-device.sh — bootstrap any dev device for goldshore-ai
# Works on: macOS, Linux, WSL, Termux (Android), iSH (iOS)
# Usage: bash scripts/setup-device.sh [device-label] [feature-branch]
# Example: bash scripts/setup-device.sh goldshore-hp
# Example: bash scripts/setup-device.sh goldshore-hp my-feature-branch
set -euo pipefail

DEVICE_LABEL="${1:-goldshore-$(hostname)}"
FEATURE_BRANCH="${2:-}"
GH_USER="marzton"
REPOS=(
  "goldshore-ai"
  "goldshore-gateway"
  "goldshore"
  "goldshore-core"
)

echo "=== Goldshore dev setup: $DEVICE_LABEL ==="

# --- SSH key ---
SSH_KEY="$HOME/.ssh/id_ed25519"
if [ ! -f "$SSH_KEY" ]; then
  echo "Generating SSH key..."
  ssh-keygen -t ed25519 -C "$DEVICE_LABEL" -N "" -f "$SSH_KEY"
else
  echo "SSH key already exists at $SSH_KEY"
fi

echo ""
echo "=== Add this public key to github.com/settings/keys ==="
echo "Title: $DEVICE_LABEL"
echo ""
cat "${SSH_KEY}.pub"
echo ""
read -rp "Press Enter once you've added the key to GitHub..."

# --- Test GitHub auth ---
echo "Testing GitHub SSH auth..."
if ssh -T git@github.com 2>&1 | grep -q "Hi $GH_USER"; then
  echo "GitHub auth OK"
else
  echo "Warning: GitHub auth may not be set up yet. Check the key was added."
fi

# --- Git config ---
if [ -z "$(git config --global user.email 2>/dev/null)" ]; then
  read -rp "Git email (e.g. marstonr6@gmail.com): " GIT_EMAIL
  read -rp "Git name (e.g. marzton): " GIT_NAME
  git config --global user.email "$GIT_EMAIL"
  git config --global user.name "$GIT_NAME"
fi
git config --global init.defaultBranch main
git config --global pull.rebase false

# --- Clone repos ---
cd "$HOME"
for REPO in "${REPOS[@]}"; do
  if [ -d "$REPO" ]; then
    echo "$REPO already cloned, fetching latest..."
    git -C "$REPO" fetch origin main 2>/dev/null || true
  else
    echo "Cloning $REPO..."
    git clone "git@github.com:$GH_USER/$REPO.git"
  fi
  # Optionally switch to a feature branch if caller requested one
  if [ -n "$FEATURE_BRANCH" ]; then
    if git -C "$REPO" ls-remote --exit-code --heads origin "$FEATURE_BRANCH" &>/dev/null; then
      git -C "$REPO" fetch origin "$FEATURE_BRANCH"
      git -C "$REPO" checkout "$FEATURE_BRANCH" 2>/dev/null || true
    else
      echo "  Branch '$FEATURE_BRANCH' not found in $REPO, staying on main"
    fi
  fi
done

# --- Node / pnpm ---
if ! command -v node &>/dev/null; then
  echo ""
  echo "Node.js not found. Install it:"
  echo "  macOS/Linux: https://nodejs.org or 'brew install node'"
  echo "  Termux: pkg install nodejs"
  echo "  iSH: apk add nodejs npm"
else
  NODE_VER=$(node --version)
  echo "Node: $NODE_VER"
fi

if ! command -v pnpm &>/dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm 2>/dev/null || echo "Run: npm install -g pnpm"
else
  echo "pnpm: $(pnpm --version)"
fi

# --- Install deps ---
if [ -d "$HOME/goldshore-ai" ]; then
  echo "Installing goldshore-ai deps..."
  (cd "$HOME/goldshore-ai" && pnpm install) || echo "pnpm install failed — run manually"
fi

# --- VS Code extensions (if code CLI available) ---
if command -v code &>/dev/null; then
  echo "Installing VS Code extensions..."
  EXTENSIONS=(
    "astro-build.astro-vscode"
    "cloudflare.cloudflare-workers-bindings-vscode"
    "esbenp.prettier-vscode"
    "bradlc.vscode-tailwindcss"
    "dbaeumer.vscode-eslint"
    "eamodio.gitlens"
    "ms-vscode.vscode-typescript-next"
    "WallabyJs.console-ninja"
  )
  for EXT in "${EXTENSIONS[@]}"; do
    code --install-extension "$EXT" --force 2>/dev/null || true
  done
  echo "Extensions installed."
fi

echo ""
echo "=== Setup complete for $DEVICE_LABEL ==="
echo "Repos cloned to: $HOME"
echo "Open workspace: code $HOME/goldshore-ai/goldshore.code-workspace"
echo ""
echo "Next steps:"
echo "  1. Renew Cloudflare token if needed (run manage-cf-tokens workflow)"
echo "  2. Set up Google API credentials in Cloudflare Worker secrets"
echo "  3. pnpm --filter gs-web dev  # start web dev server"
