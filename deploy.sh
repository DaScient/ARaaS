#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Build & Deploy ARaaS to GitHub Pages
# DaScient, LLC | Proprietary
# =============================================================================
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Prerequisites:
#   - Node.js ≥ 18
#   - npm ≥ 9
#   - Git remote 'origin' pointed at the GitHub repository
#   - Write access to the 'gh-pages' branch
# =============================================================================

set -euo pipefail

echo "╔══════════════════════════════════════════╗"
echo "║  ARaaS — GitHub Pages Deployment Script  ║"
echo "║  DaScient, LLC                           ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Ensure we're on the right branch ────────────────────────────────────
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "▶ Current branch: ${CURRENT_BRANCH}"

# ── 2. Install dependencies ────────────────────────────────────────────────
echo "▶ Installing dependencies…"
npm ci --prefer-offline

# ── 3. Run Vite production build ───────────────────────────────────────────
echo "▶ Building production bundle (Vite)…"
npm run build

DIST_DIR="./dist"
if [ ! -d "$DIST_DIR" ]; then
  echo "✗ Build failed — dist/ directory not found."
  exit 1
fi
echo "✓ Build succeeded → ${DIST_DIR}"

# ── 4. Copy CNAME if present ──────────────────────────────────────────────
if [ -f "CNAME" ]; then
  cp CNAME "${DIST_DIR}/CNAME"
  echo "✓ Copied CNAME"
fi

# ── 5. Push dist/ to gh-pages branch ─────────────────────────────────────
echo "▶ Deploying to gh-pages…"

# Use a temp directory for the gh-pages checkout
TMPDIR=$(mktemp -d)
trap "rm -rf ${TMPDIR}" EXIT

REPO_URL=$(git remote get-url origin)
git clone --depth=1 --branch=gh-pages "${REPO_URL}" "${TMPDIR}/gh-pages" 2>/dev/null || {
  # Branch doesn't exist yet — create it
  git clone --depth=1 "${REPO_URL}" "${TMPDIR}/gh-pages"
  cd "${TMPDIR}/gh-pages"
  git checkout --orphan gh-pages
  git rm -rf . > /dev/null
  cd -
}

# Copy built files
cd "${TMPDIR}/gh-pages"
# Clean old files (keep .git)
find . -maxdepth 1 ! -name '.git' -exec rm -rf {} + 2>/dev/null || true
cp -r "${OLDPWD}/${DIST_DIR}/." .

# Add .nojekyll so GitHub Pages serves all files
touch .nojekyll

git add -A
COMMIT_SHA=$(cd "${OLDPWD}" && git rev-parse --short HEAD)
git commit -m "deploy: ${COMMIT_SHA} — $(date -u '+%Y-%m-%d %H:%M UTC')" --allow-empty
git push origin gh-pages

cd "${OLDPWD}"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✓ Deployment complete!                  ║"
echo "║  https://DaScient.github.io/ARaaS/       ║"
echo "╚══════════════════════════════════════════╝"
