param(
  [string]$RepoRoot = "E:\OneDrive\Documents\goldshore-ai",
  [switch]$PullMainIfClean,
  [switch]$StartSecretSyncApp,
  [switch]$OpenAdmin
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-Command {
  param([string]$Name)
  $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-WithoutCloudflareTokenEnv {
  param([scriptblock]$Script)

  $names = @(
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_SYNC_AUTH_TOKEN",
    "CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN"
  )
  $saved = @{}
  foreach ($name in $names) {
    $saved[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
  }

  try {
    & $Script
  } finally {
    foreach ($name in $names) {
      if ($null -ne $saved[$name]) {
        [Environment]::SetEnvironmentVariable($name, $saved[$name], "Process")
      }
    }
  }
}

if (!(Test-Path -LiteralPath $RepoRoot)) {
  throw "GoldShore repo root not found: $RepoRoot"
}

Set-Location -LiteralPath $RepoRoot

$env:GOLDSHORE_REPO_ROOT = $RepoRoot
$env:GOLDSHORE_AGENT_ENV = "goldclaw-local"
$env:GOLDSHORE_MCP_URL = "https://mcp.goldshore.ai/mcp"
$env:GOLDSHORE_API_URL = "https://api.goldshore.ai"
$env:GOLDSHORE_ADMIN_URL = "https://admin.goldshore.ai"
$env:GOLDSHORE_DASH_URL = "https://dash.goldshore.ai"
$env:GOLDSHORE_AGENT_URL = "https://agent.goldshore.ai"
$env:GOLDSHORE_SECRET_MANIFEST = "infra/secrets/secret-sync.manifest.yaml"

Write-Step "GoldClaw local agent environment"
Write-Host "Repo:        $RepoRoot"
Write-Host "MCP:         $env:GOLDSHORE_MCP_URL"
Write-Host "API:         $env:GOLDSHORE_API_URL"
Write-Host "Admin:       $env:GOLDSHORE_ADMIN_URL"
Write-Host "Manifest:    $env:GOLDSHORE_SECRET_MANIFEST"

Write-Step "Canonical files"
$canonicalFiles = @(
  "AGENTS.md",
  ".mcp.json",
  "infra/secrets/secret-sync.manifest.yaml",
  "scripts/sync-secrets.mjs",
  "scripts/secret-sync-app.mjs",
  "apps/gs-api/src/routes/goldclaw.ts",
  "apps/gs-web/src/pages/admin/goldclaw.astro",
  "docs/GOLDCLAW_INTEGRATIONS.md",
  "docs/domains-and-auth.md"
)
foreach ($file in $canonicalFiles) {
  $state = if (Test-Path -LiteralPath $file) { "ok" } else { "missing" }
  Write-Host ("{0,-58} {1}" -f $file, $state)
}

Write-Step "Git main sync"
if (Test-Command git) {
  $branch = (& git branch --show-current).Trim()
  Write-Host "Current branch: $branch"
  & git fetch origin main --prune | Out-Host
  $status = (& git status --porcelain)
  $dirty = -not [string]::IsNullOrWhiteSpace(($status -join "`n"))
  $mainGap = (& git rev-list --left-right --count HEAD...origin/main 2>$null).Trim()
  if ($mainGap) {
    $parts = $mainGap -split "\s+"
    Write-Host "Compared to origin/main: ahead=$($parts[0]) behind=$($parts[1])"
  }
  if ($dirty) {
    Write-Host "Working tree has local changes; auto-pull disabled." -ForegroundColor Yellow
  } elseif ($PullMainIfClean -and $branch -eq "main") {
    & git pull --ff-only origin main | Out-Host
  } elseif ($PullMainIfClean) {
    Write-Host "Not on main; fetched origin/main but did not pull into $branch." -ForegroundColor Yellow
  } else {
    Write-Host "Fetched origin/main. Pass -PullMainIfClean to fast-forward only when clean/on main."
  }
} else {
  Write-Host "git not found." -ForegroundColor Yellow
}

Write-Step "Auth surfaces"
if (Test-Command gh) {
  & gh auth status -h github.com | Out-Host
} else {
  Write-Host "gh not found." -ForegroundColor Yellow
}

if (Test-Command npx) {
  Invoke-WithoutCloudflareTokenEnv {
    & npx wrangler whoami | Out-Host
  }
} else {
  Write-Host "npx not found; skipped Wrangler SSO status." -ForegroundColor Yellow
}

Write-Step "Secret manifest guard"
if (Test-Path -LiteralPath "scripts/sync-secrets.mjs") {
  & node scripts/sync-secrets.mjs check | Out-Host
} else {
  Write-Host "scripts/sync-secrets.mjs missing." -ForegroundColor Yellow
}

Write-Step "Local runtime vault presence"
$runtimePath = Join-Path $RepoRoot "env.secrets.runtime.json"
if (Test-Path -LiteralPath $runtimePath) {
  $runtime = Get-Content -Raw -LiteralPath $runtimePath | ConvertFrom-Json
  $keys = @(
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_GOLDCLAW_AGENT_ADMIN_TOKEN",
    "CLOUDFLARE_OAUTH_CLIENT_ID",
    "CLOUDFLARE_SYNC_AUTH_TOKEN",
    "CLOUDFLARE_API_TOKEN",
    "GITHUB_OAUTH_CLIENT_ID",
    "ACCESS_CLIENT_SECRET",
    "CONTROL_SYNC_TOKEN",
    "JWT_SECRET"
  )
  foreach ($key in $keys) {
    $prop = $runtime.PSObject.Properties[$key]
    $present = $null -ne $prop -and -not [string]::IsNullOrWhiteSpace([string]$prop.Value)
    Write-Host ("{0,-34} {1}" -f $key, $(if ($present) { "present" } else { "missing" }))
  }
} else {
  Write-Host "env.secrets.runtime.json not found. Use pnpm secrets:app to populate local-only values."
}

Write-Step "Cloudflare agent API access"
if (Test-Path -LiteralPath "scripts/check-cloudflare-agent-access.mjs") {
  & node scripts/check-cloudflare-agent-access.mjs | Out-Host
} else {
  Write-Host "scripts/check-cloudflare-agent-access.mjs missing." -ForegroundColor Yellow
}

Write-Step "MCP config presence"
$mcpFiles = @(".mcp.json", ".vscode/mcp.json", ".cursor/mcp.json", "C:\Users\marst\.claude\mcp.json")
foreach ($file in $mcpFiles) {
  if (Test-Path -LiteralPath $file) {
    $raw = Get-Content -Raw -LiteralPath $file
    $hasGoldshore = $raw -match "https://mcp\.goldshore\.ai/mcp"
    $hasCloudflare = $raw -match "https://mcp\.cloudflare\.com/mcp"
    $hasAtlassian = $raw -match "https://mcp\.atlassian\.com/v1/mcp/authv2"
    Write-Host ("{0,-36} goldshore={1} cloudflare={2} atlassian={3}" -f $file, $hasGoldshore, $hasCloudflare, $hasAtlassian)
  } else {
    Write-Host ("{0,-36} missing" -f $file) -ForegroundColor Yellow
  }
}

Write-Step "VS Code remote tunnel"
if (Test-Command code) {
  try {
    $statusRaw = (& code tunnel status 2>$null)
    $status = $statusRaw | ConvertFrom-Json
    $tunnelName = [string]$status.tunnel.name
    $tunnelState = [string]$status.tunnel.tunnel
    $serviceInstalled = [bool]$status.service_installed
    Write-Host ("Name:              {0}" -f $tunnelName)
    Write-Host ("State:             {0}" -f $tunnelState)
    Write-Host ("Service installed: {0}" -f $serviceInstalled)
    if (-not [string]::IsNullOrWhiteSpace($tunnelName)) {
      Write-Host ("Android URL:       https://vscode.dev/tunnel/{0}" -f $tunnelName)
      Write-Host ("Workspace path:    {0}" -f $RepoRoot)
    }
    try {
      & code tunnel user show | Out-Host
    } catch {
      Write-Host "VS Code tunnel account status unavailable." -ForegroundColor Yellow
    }
  } catch {
    Write-Host "VS Code tunnel status unavailable. Run: code tunnel --name laptop-treb --accept-server-license-terms" -ForegroundColor Yellow
  }
} else {
  Write-Host "VS Code CLI not found; skipped remote tunnel status." -ForegroundColor Yellow
}

if ($StartSecretSyncApp) {
  Write-Step "Secret Sync local app"
  $listener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8798 -ErrorAction SilentlyContinue |
    Where-Object State -eq "Listen" |
    Select-Object -First 1
  if ($listener) {
    Write-Host "Already running at http://127.0.0.1:8798/ (PID $($listener.OwningProcess))"
  } else {
    $process = Start-Process -FilePath node -ArgumentList "scripts\secret-sync-app.mjs" -WorkingDirectory $RepoRoot -WindowStyle Hidden -PassThru
    Write-Host "Started Secret Sync app at http://127.0.0.1:8798/ (PID $($process.Id))"
  }
}

if ($OpenAdmin) {
  Start-Process "https://admin.goldshore.ai/admin/goldclaw"
}

Write-Step "Ready"
Write-Host "Terminal is now in: $(Get-Location)"
Write-Host "Claude should be launched from this directory so it reads project AGENTS.md, .mcp.json, and .claude/settings.json."
