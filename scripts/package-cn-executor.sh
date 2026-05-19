#!/bin/bash
# Build and package cn-executor for Aliyun Function Compute deployment.
# Produces: /Users/aaron/creator-city/apps/cn-executor/cn-executor-deploy.zip
#
# Usage:
#   cd /Users/aaron/creator-city
#   bash scripts/package-cn-executor.sh
#
# Requirements: node >= 20, npm, pnpm

set -e

REPO="/Users/aaron/creator-city"
SRC="$REPO/apps/cn-executor"
DEPLOY_DIR="/tmp/reator-city-cn-executor-deploy"
NPM_CACHE_DIR="${NPM_CACHE_DIR:-/tmp/reator-city-cn-executor-npm-cache}"
ZIP_OUT="$SRC/cn-executor-deploy.zip"

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
mkdir -p "$NPM_CACHE_DIR"
NPM_CONFIG_CACHE="$NPM_CACHE_DIR" npm install --omit=dev --include=optional --ignore-scripts --no-package-lock

echo "=== Preflight checks ==="
node -e "require('ali-oss'); require('debug'); require('ms'); require('escape-html'); require('utility'); require('stream-wormhole'); require('xml2js'); require('pg'); console.log('dependency preflight ok')"

test -f dist/server.js         || (echo "MISSING: dist/server.js" && exit 1)
test -d node_modules/ali-oss   || (echo "MISSING: node_modules/ali-oss" && exit 1)
test -d node_modules/debug     || (echo "MISSING: node_modules/debug" && exit 1)
test -d node_modules/ms        || (echo "MISSING: node_modules/ms" && exit 1)
test -d node_modules/escape-html || (echo "MISSING: node_modules/escape-html" && exit 1)
test -d node_modules/utility   || (echo "MISSING: node_modules/utility" && exit 1)
test -d node_modules/stream-wormhole || (echo "MISSING: node_modules/stream-wormhole" && exit 1)
test -d node_modules/xml2js    || (echo "MISSING: node_modules/xml2js" && exit 1)
test -d node_modules/pg        || (echo "MISSING: node_modules/pg" && exit 1)
test -x bootstrap              || (echo "MISSING: bootstrap" && exit 1)

echo "=== Creating zip ==="
rm -f "$ZIP_OUT"
zip -r "$ZIP_OUT" . -x "*.DS_Store" -x "*.map"
ls -lh "$ZIP_OUT"
echo "=== done ==="
