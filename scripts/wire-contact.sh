#!/usr/bin/env bash
# wire-contact.sh — wire up the contact form for a client site
# Usage: scripts/wire-contact.sh {slug} {client-email}
# Example: scripts/wire-contact.sh saskair ryan@saskair.ca

set -euo pipefail

SLUG="${1:?Usage: wire-contact.sh <slug> <email>}"
EMAIL="${2:?Usage: wire-contact.sh <slug> <email>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE_DIR="$ROOT/clients/$SLUG/site"
API_DIR="$SITE_DIR/api"

if [ ! -d "$SITE_DIR" ]; then
  echo "❌ Site directory not found: $SITE_DIR"
  exit 1
fi

echo "Wiring contact form for $SLUG → $EMAIL"

# Create api directory
mkdir -p "$API_DIR"

# Copy and configure the handler
sed \
  -e "s/PLACEHOLDER_EMAIL/$EMAIL/g" \
  -e "s/PLACEHOLDER_SLUG/$SLUG/g" \
  "$ROOT/scripts/templates/contact-handler.js" > "$API_DIR/contact.js"

echo "✓ wrote $API_DIR/contact.js"

# Update all form actions in the site from /api/lead to /api/contact
find "$SITE_DIR" -name "*.html" | while read -r f; do
  if grep -q 'action="/api/lead"' "$f"; then
    sed -i '' 's|action="/api/lead"|action="/api/contact"|g' "$f"
    echo "✓ updated form action in $(basename $f)"
  fi
done

# Add success message handling to contact.html if it exists
if [ -f "$SITE_DIR/contact.html" ]; then
  if ! grep -q "sent=1" "$SITE_DIR/contact.html"; then
    # Add a success banner that shows when ?sent=1 is in the URL
    SUCCESS_SCRIPT='<script>
if(new URLSearchParams(location.search).get("sent")==="1"){
  const b=document.createElement("div");
  b.style="position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1D9E75;color:#fff;padding:14px 28px;border-radius:8px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.3)";
  b.textContent="✓ Message sent — we will be in touch within one business day!";
  document.body.appendChild(b);
  setTimeout(()=>b.remove(),6000);
}
</script>'
    # Insert before </body>
    sed -i '' "s|</body>|$SUCCESS_SCRIPT\n</body>|g" "$SITE_DIR/contact.html"
    echo "✓ added success message to contact.html"
  fi
fi

# Set the RESEND_API_KEY and CONTACT_RECIPIENT in Vercel env
if [ -n "${VERCEL_TOKEN:-}" ]; then
  VERCEL_SCOPE="${VERCEL_SCOPE:-}"
  SCOPE_FLAG="${VERCEL_SCOPE:+--scope $VERCEL_SCOPE}"

  echo "Setting Vercel env vars..."
  echo "$EMAIL" | vercel env add CONTACT_RECIPIENT production $SCOPE_FLAG --token "$VERCEL_TOKEN" --yes 2>/dev/null || true
  echo "${RESEND_API_KEY:-}" | vercel env add RESEND_API_KEY production $SCOPE_FLAG --token "$VERCEL_TOKEN" --yes 2>/dev/null || true
  echo "✓ Vercel env vars set"

  # Redeploy
  echo "Redeploying..."
  cd "$SITE_DIR"
  vercel deploy --prod --yes $SCOPE_FLAG --token "$VERCEL_TOKEN"
  echo "✓ Redeployed with working contact form"
else
  echo "⚠ VERCEL_TOKEN not set — skipping Vercel env + deploy"
  echo "  Run manually:"
  echo "  cd $SITE_DIR && vercel deploy --prod --yes"
fi

echo ""
echo "✓ Contact form wired: $SLUG → $EMAIL"
echo "  Test it at: https://$SLUG.actiondesignstudio.com/contact.html"
