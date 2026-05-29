#!/usr/bin/env bash
# check-boundary-touch.sh
# Checks whether the current git diff touches any Forbidden Zone files.
# Run before every commit on Creator City.
# Usage: bash scripts/check-boundary-touch.sh [--staged] [--base <ref>]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ── Parse flags ────────────────────────────────────────────────────────────────
STAGED=0
BASE_REF="HEAD"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --staged) STAGED=1; shift ;;
    --base)   BASE_REF="$2"; shift 2 ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

# ── Collect changed files ──────────────────────────────────────────────────────
if [[ "$STAGED" -eq 1 ]]; then
  CHANGED=$(git diff --cached --name-only 2>/dev/null || true)
elif git rev-parse --verify "$BASE_REF" &>/dev/null; then
  CHANGED=$(git diff --name-only "$BASE_REF" 2>/dev/null || true)
else
  # No commits yet — compare against empty tree
  CHANGED=$(git diff --name-only "$(git hash-object -t tree /dev/null)" 2>/dev/null || true)
fi

# Also include untracked new files that are staged
UNTRACKED_STAGED=$(git diff --cached --name-only --diff-filter=A 2>/dev/null || true)
CHANGED=$(printf '%s\n%s' "$CHANGED" "$UNTRACKED_STAGED" | sort -u | grep -v '^$' || true)

if [[ -z "$CHANGED" ]]; then
  echo "✅ PASS — no changed files detected (working tree matches $BASE_REF)."
  exit 0
fi

# ── Forbidden Zone patterns ────────────────────────────────────────────────────
# Each pattern is a substring or glob matched against the relative file path.
FORBIDDEN_EXACT=(
  "apps/web/src/app/api/generate/image/route.ts"
  "apps/web/src/app/api/generate/video/route.ts"
  "apps/web/src/app/api/generate/video/status/route.ts"
  "apps/web/src/app/api/projects"
  "apps/web/src/app/api/media/proxy/route.ts"
  "apps/web/src/lib/provider-management"
  "package.json"
  "pnpm-lock.yaml"
  "tsconfig.base.json"
)

FORBIDDEN_PREFIX=(
  "apps/cn-executor/src/"
  "prisma/"
  "supabase/migrations/"
)

FORBIDDEN_SUFFIX=(
  "schema.prisma"
  ".env"
  ".env.local"
  ".env.production"
  ".env.staging"
)

# ── Check each changed file ────────────────────────────────────────────────────
HITS=()

check_file() {
  local f="$1"

  # Exact substring match
  for pattern in "${FORBIDDEN_EXACT[@]}"; do
    if [[ "$f" == *"$pattern"* ]]; then
      HITS+=("$f  ← matches forbidden: $pattern")
      return
    fi
  done

  # Prefix match
  for pattern in "${FORBIDDEN_PREFIX[@]}"; do
    if [[ "$f" == "$pattern"* ]]; then
      HITS+=("$f  ← matches forbidden prefix: $pattern")
      return
    fi
  done

  # Suffix / filename match
  for pattern in "${FORBIDDEN_SUFFIX[@]}"; do
    if [[ "$f" == *"$pattern" ]]; then
      HITS+=("$f  ← matches forbidden suffix: $pattern")
      return
    fi
  done
}

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  check_file "$file"
done <<< "$CHANGED"

# ── Report ─────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "   Creator City — P0 Boundary Guard"
echo "════════════════════════════════════════════════════════"
echo ""
CHANGED_COUNT=$(printf '%s\n' "$CHANGED" | grep -c . || true)
echo "Changed files (${CHANGED_COUNT} total):"
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  echo "  $f"
done <<< "$CHANGED"
echo ""

if [[ ${#HITS[@]} -gt 0 ]]; then
  echo "❌ FORBIDDEN ZONE TOUCHED — STOP BEFORE COMMITTING"
  echo ""
  echo "The following files are in the Forbidden Zone:"
  for hit in "${HITS[@]}"; do
    echo "  🚫  $hit"
  done
  echo ""
  echo "Action required:"
  echo "  1. Do NOT commit these changes without explicit user authorization."
  echo "  2. Open a dedicated P0 fix task and get user sign-off."
  echo "  3. To revert a file:  git checkout HEAD -- <file>"
  echo "  4. See docs/P0_BOUNDARY_LOCK.md for the full Forbidden Zone list."
  echo ""
  exit 1
else
  echo "✅ PASS — no Forbidden Zone files touched."
  echo ""
  echo "Safe to proceed with commit. Remember to also run:"
  echo "  pnpm type-check && pnpm build && pnpm lint"
  echo ""
  exit 0
fi
