#!/usr/bin/env bash
set -euo pipefail
# Onboard a built factory client into the editor end-to-end.
# Usage: OPERATOR_TOKEN=… POSTGRES_URL=… VERCEL_TOKEN=… VERCEL_TEAM_ID=… EDITOR_BASE=… \
#        scripts/onboard-editor-client.sh <slug> "<Display Name>" [tier]
SLUG="${1:?slug required}"; NAME="${2:?display name required}"; TIER="${3:-Everything}"
: "${OPERATOR_TOKEN:?}"; : "${POSTGRES_URL:?}"; : "${VERCEL_TOKEN:?}"; : "${VERCEL_TEAM_ID:?}"; : "${EDITOR_BASE:?}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "1/5 push (tag + ingest pages/assets)…"
( cd "$ROOT/editor/engine" && npx tsx src/cli.ts push "$SLUG" --endpoint "$EDITOR_BASE" --token "$OPERATOR_TOKEN" --root "$ROOT" --name "$NAME" --tier "$TIER" )

PROJECT_ID="$(node -e "console.log(require('$ROOT/clients/$SLUG/site/.vercel/project.json').projectId)")"
PROJECT_NAME="$(node -e "console.log(require('$ROOT/clients/$SLUG/site/.vercel/project.json').projectName)")"
ORIGIN="https://$PROJECT_NAME.vercel.app"

echo "2/5 set project id + origin in DB…"
( cd "$ROOT/editor/app" && node -e "const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.POSTGRES_URL});await p.query('UPDATE clients SET vercel_project_id=\$2, custom_domain=\$3 WHERE slug=\$1',['$SLUG','$PROJECT_ID','$ORIGIN']);await p.end()})()" )

echo "3/5 set client password…"
CPW="$(node -e "const c=require('crypto');const w=['River','Cedar','Slate','Birch','Onyx','Pine'];console.log(w[c.randomInt(w.length)]+'-'+w[c.randomInt(w.length)]+'-'+c.randomInt(1000,9999))")"
curl -fsS -X POST "$EDITOR_BASE/api/admin/credentials" -H "authorization: Bearer $OPERATOR_TOKEN" -H 'content-type: application/json' \
  -d "{\"username\":\"$SLUG\",\"slug\":\"$SLUG\",\"password\":\"$CPW\"}" >/dev/null

echo "4/5 disable Vercel deployment protection on $PROJECT_NAME…"
curl -fsS -X PATCH "https://api.vercel.com/v9/projects/$PROJECT_NAME?teamId=$VERCEL_TEAM_ID" \
  -H "authorization: Bearer $VERCEL_TOKEN" -H 'content-type: application/json' -d '{"ssoProtection":null}' >/dev/null

echo "5/5 publish (re-deploy with loader)…"
OP_TOKEN_SESSION="$(curl -fsS -X POST "$EDITOR_BASE/api/auth/login" -H 'content-type: application/json' \
  -d "{\"username\":\"${OPERATOR_USERNAME:-michael}\",\"password\":\"${OPERATOR_PASSWORD:?set OPERATOR_PASSWORD}\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.parse(d).token))")"
curl -fsS -X POST "$EDITOR_BASE/api/publish" -H "authorization: Bearer $OP_TOKEN_SESSION" -H 'content-type: application/json' -d "{\"slug\":\"$SLUG\"}" >/dev/null

echo ""
echo "DONE. Invite:"
echo "  Edit link: $ORIGIN/?edit"
echo "  Username:  $SLUG"
echo "  Password:  $CPW"
