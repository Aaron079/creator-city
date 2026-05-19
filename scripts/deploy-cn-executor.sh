#!/bin/bash
# Package and deploy cn-executor to Aliyun Function Compute.
#
# Usage:
#   cd /Users/aaron/creator-city
#   bash scripts/deploy-cn-executor.sh
#
# Optional env:
#   FC_FUNCTION_NAME=reator-city-cn-executor
#   ALIYUN_CLI=/tmp/aliyun
#   SKIP_PACKAGE=1

set -euo pipefail

REPO="/Users/aaron/creator-city"
ALIYUN_CLI="${ALIYUN_CLI:-/tmp/aliyun}"
FC_FUNCTION_NAME="${FC_FUNCTION_NAME:-reator-city-cn-executor}"
FC_REGION="${FC_REGION:-cn-beijing}"
ZIP_OUT="${ZIP_OUT:-$REPO/apps/cn-executor/cn-executor-deploy.zip}"

if [ ! -x "$ALIYUN_CLI" ]; then
  echo "ERROR: Aliyun CLI not found or not executable at $ALIYUN_CLI" >&2
  exit 1
fi

if [ "${SKIP_PACKAGE:-0}" != "1" ]; then
  bash "$REPO/scripts/package-cn-executor.sh"
fi

if [ ! -f "$ZIP_OUT" ]; then
  echo "ERROR: deployment zip not found: $ZIP_OUT" >&2
  exit 1
fi

echo "=== Validating Aliyun FC function ==="
function_json="$(mktemp)"
"$ALIYUN_CLI" fc GET "/2023-03-30/functions/$FC_FUNCTION_NAME" > "$function_json"

node - "$function_json" "$FC_FUNCTION_NAME" <<'NODE'
const fs = require('fs')
const [file, expectedName] = process.argv.slice(2)
const info = JSON.parse(fs.readFileSync(file, 'utf8'))

if (info.functionName !== expectedName) {
  console.error(`ERROR: expected functionName ${expectedName}, got ${info.functionName || '<missing>'}`)
  process.exit(1)
}

console.log(`Function: ${info.functionName}`)
console.log(`Runtime: ${info.runtime || '<unknown>'}`)
console.log(`Timeout: ${info.timeout ?? '<unknown>'}`)
NODE

echo "=== Deploying cn-executor zip ==="
set +e
node - "$ZIP_OUT" "$FC_FUNCTION_NAME" "$FC_REGION" <<'NODE'
const crypto = require('crypto')
const fs = require('fs')
const https = require('https')
const os = require('os')
const path = require('path')

const [zipPath, functionName, fallbackRegion] = process.argv.slice(2)
const configPath = path.join(os.homedir(), '.aliyun', 'config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const profile = config.profiles.find((item) => item.name === config.current) || config.profiles[0]

if (!profile?.access_key_id || !profile?.access_key_secret) {
  console.error('ERROR: Aliyun CLI profile is missing access_key_id/access_key_secret')
  process.exit(1)
}

const region = profile.region_id || fallbackRegion
const endpoint = `fcv3.${region}.aliyuncs.com`
const requestPath = `/2023-03-30/functions/${encodeURIComponent(functionName)}`
const zipFile = fs.readFileSync(zipPath).toString('base64')
const body = Buffer.from(JSON.stringify({ code: { zipFile } }))
const date = new Date().toUTCString()
const headers = {
  Accept: 'application/json',
  'Content-MD5': crypto.createHash('md5').update(body).digest('base64'),
  'Content-Type': 'application/json',
  Date: date,
  'x-acs-region-id': region,
  'x-acs-signature-method': 'HMAC-SHA1',
  'x-acs-signature-version': '1.0',
  'x-acs-version': '2023-03-30',
}

if (profile.sts_token) {
  headers['x-acs-security-token'] = profile.sts_token
}

const canonicalizedHeaders = Object.entries(headers)
  .filter(([key]) => key.toLowerCase().startsWith('x-acs-'))
  .map(([key, value]) => [key.toLowerCase(), String(value)])
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([key, value]) => `${key}:${value}`)
  .join('\n')

const stringToSign = [
  'PUT',
  headers.Accept,
  headers['Content-MD5'],
  headers['Content-Type'],
  headers.Date,
  canonicalizedHeaders,
  requestPath,
].join('\n')

headers.Authorization = `acs ${profile.access_key_id}:${crypto
  .createHmac('sha1', profile.access_key_secret)
  .update(stringToSign)
  .digest('base64')}`
headers['Content-Length'] = body.length

const request = https.request(
  {
    hostname: endpoint,
    method: 'PUT',
    path: requestPath,
    headers,
    timeout: 180000,
  },
  (response) => {
    const chunks = []
    response.on('data', (chunk) => chunks.push(chunk))
    response.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      let payload = null
      try {
        payload = raw ? JSON.parse(raw) : null
      } catch {
        payload = null
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        console.error(`ERROR: UpdateFunction failed with HTTP ${response.statusCode}`)
        console.error(raw || '<empty response>')
        process.exit(1)
      }

      console.log(`UpdateFunction HTTP ${response.statusCode}`)
      if (payload?.functionName) console.log(`Function: ${payload.functionName}`)
      if (payload?.codeChecksum) console.log(`Code checksum: ${payload.codeChecksum}`)
      if (payload?.lastModifiedTime) console.log(`Last modified: ${payload.lastModifiedTime}`)
    })
  }
)

request.on('timeout', () => request.destroy(new Error('timeout')))
request.on('error', (error) => {
  console.error(`WARNING: UpdateFunction request ended with: ${error.message}`)
  process.exit(2)
})

request.end(body)
NODE
upload_status=$?
set -e

if [ "$upload_status" -ne 0 ]; then
  echo "=== Verifying deploy after interrupted response ==="
fi

after_function_json="$(mktemp)"
"$ALIYUN_CLI" fc GET "/2023-03-30/functions/$FC_FUNCTION_NAME" > "$after_function_json"

code_json="$(mktemp)"
"$ALIYUN_CLI" fc GET "/2023-03-30/functions/$FC_FUNCTION_NAME/code" > "$code_json"

node - "$function_json" "$after_function_json" "$code_json" "$upload_status" "$FC_FUNCTION_NAME" "$ZIP_OUT" <<'NODE'
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const fs = require('fs')
const https = require('https')
const os = require('os')
const path = require('path')

const [beforeFile, afterFile, codeFile, uploadStatusText, functionName, zipPath] = process.argv.slice(2)
const before = JSON.parse(fs.readFileSync(beforeFile, 'utf8'))
const after = JSON.parse(fs.readFileSync(afterFile, 'utf8'))
const code = JSON.parse(fs.readFileSync(codeFile, 'utf8'))
const uploadStatus = Number(uploadStatusText)

function hashRemoteZip(url) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`remote code download failed with HTTP ${response.statusCode}`))
          return
        }
        response.on('data', (chunk) => hash.update(chunk))
        response.on('end', () => resolve(hash.digest('hex')))
      })
      .on('error', reject)
  })
}

function downloadRemoteZip(url) {
  return new Promise((resolve, reject) => {
    const zipPath = path.join(os.tmpdir(), `reator-city-cn-executor-remote-${Date.now()}.zip`)
    const output = fs.createWriteStream(zipPath)
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`remote code download failed with HTTP ${response.statusCode}`))
          return
        }
        response.pipe(output)
        output.on('finish', () => output.close(() => resolve(zipPath)))
      })
      .on('error', reject)
  })
}

function hashZipKeyEntries(zipPath) {
  const entries = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((entry) => entry === 'bootstrap' || entry === 'package.json' || (entry.startsWith('dist/') && entry.endsWith('.js')))
    .sort()

  return Object.fromEntries(
    entries.map((entry) => {
      const content = execFileSync('unzip', ['-p', zipPath, entry])
      return [entry, crypto.createHash('sha256').update(content).digest('hex')]
    })
  )
}

(async () => {
  if (after.functionName && after.functionName !== functionName) {
    console.error(`ERROR: expected functionName ${functionName}, got ${after.functionName}`)
    process.exit(1)
  }

  const checksumChanged = Boolean(before.codeChecksum && after.codeChecksum && before.codeChecksum !== after.codeChecksum)
  const modifiedChanged = Boolean(
    before.lastModifiedTime && after.lastModifiedTime && before.lastModifiedTime !== after.lastModifiedTime
  )

  if (uploadStatus !== 0 && !checksumChanged && !modifiedChanged) {
    if (!code.url) {
      console.error('ERROR: UpdateFunction response was interrupted and FC metadata did not change.')
      process.exit(1)
    }

    const localHash = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex')
    const remoteHash = await hashRemoteZip(code.url)
    if (localHash !== remoteHash) {
      const remoteZipPath = await downloadRemoteZip(code.url)
      const localEntries = hashZipKeyEntries(zipPath)
      const remoteEntries = hashZipKeyEntries(remoteZipPath)
      if (JSON.stringify(localEntries) !== JSON.stringify(remoteEntries)) {
        console.error('ERROR: UpdateFunction response was interrupted and remote code does not match local zip.')
        process.exit(1)
      }
      console.log('UpdateFunction response was interrupted, but remote code package content matches local zip.')
    } else {
      console.log('UpdateFunction response was interrupted, but remote code already matches local zip.')
    }
  } else if (uploadStatus !== 0) {
    console.log('UpdateFunction response was interrupted, but FC metadata changed after the upload.')
  }

  console.log(`Function: ${after.functionName || functionName}`)
  if (after.codeChecksum) console.log(`Code checksum: ${after.codeChecksum}`)
  if (after.lastModifiedTime) console.log(`Last modified: ${after.lastModifiedTime}`)
  if (code.checksum) console.log(`Verified code checksum: ${code.checksum}`)
})().catch((error) => {
  console.error(`ERROR: ${error.message}`)
  process.exit(1)
})
NODE

echo "=== done ==="
