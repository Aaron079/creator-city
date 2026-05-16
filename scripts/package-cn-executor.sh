#!/bin/bash
# Build and package cn-executor for Aliyun Function Compute deployment.
# Produces: /Users/aaron/creator-city/cn-executor-deploy.zip
#
# Usage:
#   cd /Users/aaron/creator-city
#   bash scripts/package-cn-executor.sh
#
# Requirements: node >= 20, npm, pnpm

set -e

REPO="/Users/aaron/creator-city"
SRC="$REPO/apps/cn-executor"
DEPLOY_DIR="/tmp/creator-city-cn-executor-deploy"
ZIP_OUT="$REPO/cn-executor-deploy.zip"

echo "=== Building cn-executor ==="
pnpm --filter cn-executor build

echo "=== Creating deploy directory ==="
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

cp -R "$SRC/dist"         "$DEPLOY_DIR/dist"
cp    "$SRC/package.json" "$DEPLOY_DIR/package.json"
cp    "$SRC/bootstrap"    "$DEPLOY_DIR/bootstrap"
chmod +x "$DEPLOY_DIR/bootstrap"

echo "=== Installing production dependencies ==="
cd "$DEPLOY_DIR"
npm install --omit=dev --include=optional --ignore-scripts --no-package-lock

echo "=== Preflight checks ==="
node -e "require('ali-oss'); require('debug'); require('escape-html'); require('utility'); console.log('preflight ok')"

test -f dist/server.js         || (echo "MISSING: dist/server.js" && exit 1)
test -d node_modules/ali-oss   || (echo "MISSING: node_modules/ali-oss" && exit 1)
test -d node_modules/debug     || (echo "MISSING: node_modules/debug" && exit 1)
test -d node_modules/escape-html || (echo "MISSING: node_modules/escape-html" && exit 1)
test -d node_modules/utility   || (echo "MISSING: node_modules/utility" && exit 1)
test -x bootstrap              || (echo "MISSING: bootstrap" && exit 1)

echo "=== Creating zip ==="
rm -f "$ZIP_OUT"
zip -r "$ZIP_OUT" . -x "*.DS_Store" -x "*.map"
ls -lh "$ZIP_OUT"
echo "=== done ==="
