#!/usr/bin/env bash
# deploy.sh — one-command deploy of the Action Studio factory.
#
# Runs the whole sequence:
#   1. Move factory to ~/code/design-studio
#   2. Collect API credentials interactively (hidden input)
#   3. Write .env locally
#   4. Install prerequisite CLIs (gh, vercel, claude) if missing
#   5. Initialize git, create the GitHub repo, push
#   6. Smoke-test the keys (Google Places, OpenAI, Vercel)
#   7. Create the Vercel project via API, set env vars, add the domain
#   8. Print clear next steps for DNS + Password Protection
#   9. Install the launchd worker
#
# Idempotent. Re-run safely. Skips steps already completed.

set -uo pipefail

# ─── Visual helpers ──────────────────────────────────────────────────
RED='\033[31m'; GREEN='\033[32m'; YELLOW='\033[33m'; BLUE='\033[34m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
step() { echo ""; echo -e "${BOLD}${BLUE}→ $1${RESET}"; }
ok()   { echo -e "  ${GREEN}✓${RESET} $1"; }
warn() { echo -e "  ${YELLOW}⚠${RESET} $1"; }
err()  { echo -e "  ${RED}✗${RESET} $1"; }
info() { echo -e "  ${DIM}$1${RESET}"; }

trap 'err "Deploy aborted at line $LINENO. Re-run after fixing."; exit 1' ERR

# ─── 1. Move factory to ~/code/design-studio ─────────────────────────
step "Step 1/9 — Locate the factory"

TARGET="$HOME/code/design-studio"
SOURCE_HINT="/Users/$(whoami)/Library/Application Support/Claude/local-agent-mode-sessions"

if [ -d "$TARGET" ]; then
  ok "Already at $TARGET"
else
  # Find the most recent action-studio-factory under Claude's sessions folder
  SOURCE=$(find "$SOURCE_HINT" -type d -name action-studio-factory 2>/dev/null | head -1)
  if [ -z "$SOURCE" ]; then
    err "Could not auto-locate the factory under $SOURCE_HINT."
    err "If you've already moved it somewhere, cd into that folder and run scripts/deploy.sh from there."
    exit 1
  fi
  info "Found factory at: $SOURCE"
  mkdir -p "$HOME/code"
  mv "$SOURCE" "$TARGET"
  ok "Moved to $TARGET"
fi

cd "$TARGET"

# ─── 2. Collect credentials interactively ────────────────────────────
step "Step 2/9 — Credentials"

if [ -f .env ] && grep -q '^GOOGLE_PLACES_API_KEY=.\+' .env 2>/dev/null; then
  ok ".env already populated. Loading existing values."
  set -a; source .env; set +a
else
  info "Paste each credential when prompted. Input is hidden (you won't see characters)."
  info "Press Enter after each one."
  echo ""

  read -s -p "  GOOGLE_PLACES_API_KEY: " GOOGLE_PLACES_API_KEY; echo
  read -s -p "  VERCEL_TOKEN:          " VERCEL_TOKEN; echo
  read -s -p "  OPENAI_API_KEY:        " OPENAI_API_KEY; echo
  echo ""
  info "GitHub PAT — need one with 'repo' scope on Michael-Penner-99/design-studio"
  info "Get one at: https://github.com/settings/tokens/new?scopes=repo&description=design-studio"
  read -s -p "  GITHUB_TOKEN:          " GITHUB_TOKEN; echo

  # Sanity-check non-empty
  [ -n "$GOOGLE_PLACES_API_KEY" ] || { err "GOOGLE_PLACES_API_KEY is empty"; exit 1; }
  [ -n "$VERCEL_TOKEN" ]          || { err "VERCEL_TOKEN is empty"; exit 1; }
  [ -n "$OPENAI_API_KEY" ]        || { err "OPENAI_API_KEY is empty"; exit 1; }
  [ -n "$GITHUB_TOKEN" ]          || { err "GITHUB_TOKEN is empty"; exit 1; }

  cat > .env <<ENVEOF
GOOGLE_PLACES_API_KEY=$GOOGLE_PLACES_API_KEY
VERCEL_TOKEN=$VERCEL_TOKEN
OPENAI_API_KEY=$OPENAI_API_KEY
GITHUB_TOKEN=$GITHUB_TOKEN
ENVEOF
  chmod 600 .env
  ok "Wrote .env (mode 600, gitignored)"
fi

# ─── 3. Install prerequisite CLIs ────────────────────────────────────
step "Step 3/9 — Prerequisite CLIs"

if ! command -v brew >/dev/null 2>&1; then
  err "Homebrew not installed. Install from https://brew.sh first, then re-run."
  exit 1
fi
ok "brew present"

for cmd in gh jq python3 git; do
  if command -v "$cmd" >/dev/null 2>&1; then
    ok "$cmd present"
  else
    info "Installing $cmd via brew..."
    brew install "$cmd" || warn "brew install $cmd failed; install manually"
  fi
done

if ! command -v vercel >/dev/null 2>&1; then
  info "Installing Vercel CLI..."
  npm install -g vercel || { err "npm install -g vercel failed"; exit 1; }
fi
ok "vercel present"

if ! command -v claude >/dev/null 2>&1; then
  info "Installing Claude Code CLI..."
  npm install -g @anthropic-ai/claude-code || warn "Claude Code install failed; install manually before worker runs"
else
  ok "claude (Claude Code) present"
fi

# ─── 4. Smoke-test the credentials ───────────────────────────────────
step "Step 4/9 — Verify credentials"

# Google Places
GP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=test&inputtype=textquery&key=$GOOGLE_PLACES_API_KEY")
if [ "$GP_STATUS" = "200" ]; then
  ok "Google Places key works"
else
  warn "Google Places returned HTTP $GP_STATUS — key may be invalid or quota exceeded. Continuing."
fi

# OpenAI
OAI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $OPENAI_API_KEY" "https://api.openai.com/v1/models")
if [ "$OAI_STATUS" = "200" ]; then
  ok "OpenAI key works"
else
  warn "OpenAI returned HTTP $OAI_STATUS — key may be invalid. Continuing."
fi

# Vercel — also captures team ID for later API calls
VERCEL_USER_JSON=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v2/user")
if echo "$VERCEL_USER_JSON" | jq -e '.user.username' >/dev/null 2>&1; then
  VERCEL_USERNAME=$(echo "$VERCEL_USER_JSON" | jq -r '.user.username')
  ok "Vercel token works (user: $VERCEL_USERNAME)"
else
  err "Vercel token invalid or expired."
  echo "$VERCEL_USER_JSON" | jq .
  exit 1
fi

# Get team ID (may be empty if user has no teams)
VERCEL_TEAM_ID=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v2/teams" | jq -r '.teams[0].id // ""')
if [ -n "$VERCEL_TEAM_ID" ]; then
  ok "Vercel team ID: $VERCEL_TEAM_ID"
  TEAM_PARAM="?teamId=$VERCEL_TEAM_ID"
else
  warn "No Vercel team — using personal account"
  TEAM_PARAM=""
fi

# GitHub
GH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/user")
if [ "$GH_STATUS" = "200" ]; then
  ok "GitHub PAT works"
else
  err "GitHub PAT returned HTTP $GH_STATUS — invalid or wrong scope."
  exit 1
fi

# ─── 5. Initialize git + push to GitHub ──────────────────────────────
step "Step 5/9 — Push to GitHub (Michael-Penner-99/design-studio)"

if [ ! -d .git ]; then
  git init -b main >/dev/null
  ok "Initialized git repo"
fi

# Configure git identity if not set
git config user.email >/dev/null 2>&1 || git config user.email "michael@innovusaccounting.com"
git config user.name  >/dev/null 2>&1 || git config user.name  "Michael Penner"

# Create the repo via API if missing
REPO_CHECK=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/repos/Michael-Penner-99/design-studio")
if [ "$REPO_CHECK" = "404" ]; then
  info "Repo doesn't exist yet — creating Michael-Penner-99/design-studio (private)..."
  curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/user/repos" \
    -d '{"name":"design-studio","private":true,"description":"Action Studio website factory"}' >/dev/null
  ok "Repo created"
elif [ "$REPO_CHECK" = "200" ]; then
  ok "Repo exists"
else
  warn "Repo lookup returned HTTP $REPO_CHECK"
fi

# Set remote (idempotent)
git remote remove origin 2>/dev/null || true
git remote add origin "https://${GITHUB_TOKEN}@github.com/Michael-Penner-99/design-studio.git"

# Commit and push
git add -A
if git diff --cached --quiet; then
  info "Nothing new to commit"
else
  git commit -m "Initial: factory + web + worker" >/dev/null
  ok "Committed"
fi
git push -u origin main --force-with-lease 2>&1 | tail -3
ok "Pushed to GitHub"

# Sanitize remote URL — remove the embedded token
git remote set-url origin "https://github.com/Michael-Penner-99/design-studio.git"

# ─── 6. Create Vercel project for the operator app ───────────────────
step "Step 6/9 — Create Vercel project for the operator app"

PROJECT_NAME="factory-actiondesignstudio"

# Check if project already exists
PROJECT_CHECK=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v9/projects/$PROJECT_NAME$TEAM_PARAM")
PROJECT_ID=$(echo "$PROJECT_CHECK" | jq -r '.id // ""')

if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
  ok "Project already exists (id: $PROJECT_ID)"
else
  CREATE_RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.vercel.com/v10/projects$TEAM_PARAM" \
    -d "{
      \"name\":\"$PROJECT_NAME\",
      \"framework\":\"nextjs\",
      \"rootDirectory\":\"web\",
      \"gitRepository\":{\"type\":\"github\",\"repo\":\"Michael-Penner-99/design-studio\"}
    }")
  PROJECT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // ""')
  if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "null" ]; then
    err "Failed to create Vercel project:"
    echo "$CREATE_RESPONSE" | jq .
    exit 1
  fi
  ok "Created Vercel project: $PROJECT_NAME (id: $PROJECT_ID)"
fi

# ─── 7. Set Vercel env vars ──────────────────────────────────────────
step "Step 7/9 — Set Vercel environment variables"

FORM_SUBMIT_TOKEN=$(openssl rand -hex 24)

set_vercel_env() {
  local key="$1"
  local value="$2"
  curl -s -X POST -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.vercel.com/v10/projects/$PROJECT_ID/env$TEAM_PARAM" \
    -d "{\"key\":\"$key\",\"value\":\"$value\",\"type\":\"encrypted\",\"target\":[\"production\",\"preview\",\"development\"]}" >/dev/null
  ok "$key set"
}

set_vercel_env GITHUB_TOKEN              "$GITHUB_TOKEN"
set_vercel_env GITHUB_REPO_OWNER         "Michael-Penner-99"
set_vercel_env GITHUB_REPO_NAME          "design-studio"
set_vercel_env GITHUB_DEFAULT_BRANCH     "main"
set_vercel_env FORM_SUBMIT_TOKEN         "$FORM_SUBMIT_TOKEN"
set_vercel_env NEXT_PUBLIC_FACTORY_DOMAIN "actiondesignstudio.com"

# ─── 8. Add the custom domain ────────────────────────────────────────
step "Step 8/9 — Attach factory.actiondesignstudio.com to the project"

DOMAIN_RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.vercel.com/v10/projects/$PROJECT_ID/domains$TEAM_PARAM" \
  -d '{"name":"factory.actiondesignstudio.com"}')

if echo "$DOMAIN_RESPONSE" | jq -e '.name' >/dev/null 2>&1; then
  ok "Domain attached"
else
  ALREADY=$(echo "$DOMAIN_RESPONSE" | jq -r '.error.code // ""')
  if [ "$ALREADY" = "domain_already_in_use" ] || [ "$ALREADY" = "domain_already_attached" ]; then
    ok "Domain already attached"
  else
    warn "Domain attach returned:"
    echo "$DOMAIN_RESPONSE" | jq .
  fi
fi

# ─── 9. Install the launchd worker + first deploy ────────────────────
step "Step 9/9 — Install local worker + trigger first deploy"

scripts/install-worker.sh
ok "Worker installed and running"

info "Triggering the first deploy via Vercel API..."
DEPLOY_TRIGGER=$(curl -s -X POST -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.vercel.com/v13/deployments$TEAM_PARAM" \
  -d "{
    \"name\":\"$PROJECT_NAME\",
    \"gitSource\":{\"type\":\"github\",\"ref\":\"main\",\"repoId\":null,\"org\":\"Michael-Penner-99\",\"repo\":\"design-studio\"},
    \"projectSettings\":{\"framework\":\"nextjs\",\"rootDirectory\":\"web\"},
    \"target\":\"production\"
  }")
DEPLOY_URL=$(echo "$DEPLOY_TRIGGER" | jq -r '.url // ""')
if [ -n "$DEPLOY_URL" ]; then
  ok "Deploy initiated: https://$DEPLOY_URL"
else
  warn "Auto-deploy didn't trigger; you may need to push to GitHub to kick off the first build."
fi

# ─── Summary ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Deploy complete (the parts that automate).${RESET}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "${BOLD}What's done:${RESET}"
echo "  ✓ Factory code at $TARGET"
echo "  ✓ Repo at https://github.com/Michael-Penner-99/design-studio"
echo "  ✓ Vercel project '$PROJECT_NAME' created (id: $PROJECT_ID)"
echo "  ✓ All env vars set in Vercel"
echo "  ✓ Domain factory.actiondesignstudio.com attached"
echo "  ✓ Local worker installed and running (tail -f $TARGET/.worker.log)"
echo ""
echo -e "${BOLD}${YELLOW}Two manual steps remain. They take 5 minutes total.${RESET}"
echo ""
echo -e "${BOLD}A) DNS records (5 min, at your domain registrar):${RESET}"
echo "   Find your DNS settings for actiondesignstudio.com and add:"
echo ""
echo "     Type   Name   Value                    TTL"
echo "     A      @      76.76.21.21              Auto"
echo "     CNAME  www    cname.vercel-dns.com.    Auto"
echo "     CNAME  *      cname.vercel-dns.com.    Auto"
echo ""
echo "   Wait 5–30 min for propagation. Test: dig +short factory.actiondesignstudio.com"
echo ""
echo -e "${BOLD}B) Password Protection (1 min, in Vercel dashboard):${RESET}"
echo "   1. Open https://vercel.com/dashboard"
echo "   2. Click the '$PROJECT_NAME' project"
echo "   3. Settings → Deployment Protection → Password Protection → Enable"
echo "   4. Set a password — write it down"
echo ""
echo -e "${BOLD}After both done:${RESET}"
echo "   Visit https://factory.actiondesignstudio.com"
echo "   You'll see Vercel's password prompt, then the operator form."
echo "   Paste a contractor URL → Start Run → watch your $TARGET/.worker.log"
echo ""
echo -e "${BOLD}Log files:${RESET}"
echo "  $TARGET/.worker.log     (per-tick worker activity)"
echo "  $TARGET/.worker.out.log (launchd stdout)"
echo "  $TARGET/.worker.err.log (launchd stderr)"
echo ""
