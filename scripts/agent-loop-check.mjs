#!/usr/bin/env node
/**
 * Creator City — Agent Loop Check
 *
 * Read-only script. Checks that all Agent memory files exist,
 * prints top pending tasks, and recommends a mode.
 *
 * Usage:
 *   node scripts/agent-loop-check.mjs
 *   pnpm agent:check
 *
 * Does NOT: write files, execute shell, call APIs, read env secrets, loop.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const REQUIRED_FILES = [
  { key: 'CURRENT_STATUS',     path: 'docs/CURRENT_STATUS.md' },
  { key: 'PROJECT_MEMORY',     path: 'docs/PROJECT_MEMORY.md' },
  { key: 'BOUNDARIES',         path: 'docs/BOUNDARIES.md' },
  { key: 'NEXT_TASKS',         path: 'docs/NEXT_TASKS.md' },
  { key: 'AGENT_LOOP',         path: 'docs/AGENT_LOOP.md' },
  { key: 'QA_RUNBOOK',         path: 'docs/QA_RUNBOOK.md' },
  { key: 'AGENT_REPORT_TEMPLATE', path: 'docs/AGENT_REPORT_TEMPLATE.md' },
  { key: 'AGENT_MODES',        path: 'docs/AGENT_MODES.md' },
]

const PENDING_STATUS_TOKENS = ['TODO', 'WAITING', 'BLOCKED', 'IN_PROGRESS']

// ─── File check ──────────────────────────────────────────────────────────────

console.log('\nCreator City Agent Loop Check')
console.log('==============================')

let allOk = true

for (const { key, path } of REQUIRED_FILES) {
  const fullPath = resolve(ROOT, path)
  const exists = existsSync(fullPath)
  if (!exists) allOk = false
  console.log(`${key.padEnd(24)}: ${exists ? 'OK' : 'MISSING — ' + path}`)
}

// ─── Parse NEXT_TASKS.md ─────────────────────────────────────────────────────

console.log('\nTop pending tasks:')

const nextTasksPath = resolve(ROOT, 'docs/NEXT_TASKS.md')
let pendingTasks = []

if (existsSync(nextTasksPath)) {
  const content = readFileSync(nextTasksPath, 'utf8')
  const lines = content.split('\n')

  // Find table rows (lines starting with | that are not header/separator rows)
  const tableRows = lines.filter((line) => {
    if (!line.startsWith('|')) return false
    if (/^\|\s*[-:]+\s*\|/.test(line)) return false // separator row
    if (/^\|\s*ID\s*\|/.test(line)) return false // header row
    return true
  })

  for (const row of tableRows) {
    const cells = row.split('|').map((c) => c.trim()).filter(Boolean)
    if (cells.length < 3) continue

    const id = cells[0]
    const title = cells[1]
    const status = cells[2]
    const priority = cells[3] ?? ''

    const isPending = PENDING_STATUS_TOKENS.some((tok) => status.toUpperCase().includes(tok))
    if (isPending) {
      pendingTasks.push({ id, title, status, priority })
    }
  }

  if (pendingTasks.length === 0) {
    console.log('  (no pending tasks found in NEXT_TASKS.md)')
  } else {
    // Sort P0 first, then P1, etc.
    pendingTasks.sort((a, b) => a.priority.localeCompare(b.priority))
    pendingTasks.slice(0, 5).forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.id} | ${t.title} | ${t.status} | ${t.priority}`)
    })
    if (pendingTasks.length > 5) {
      console.log(`  ... and ${pendingTasks.length - 5} more`)
    }
  }
} else {
  console.log('  (NEXT_TASKS.md missing — cannot parse)')
}

// ─── Recommend mode ───────────────────────────────────────────────────────────

console.log('\nRecommended mode:')

if (pendingTasks.length === 0) {
  console.log('  AUDIT_ONLY — no pending tasks; review NEXT_TASKS.md')
} else {
  const top = pendingTasks[0]
  const titleLower = (top.title ?? '').toLowerCase()
  const idLower = (top.id ?? '').toLowerCase()

  if (titleLower.includes('qa') || idLower.includes('qa')) {
    console.log(`  QA_ONLY — top task "${top.id}" is QA`)
  } else if (titleLower.includes('audit') || titleLower.includes('read') || titleLower.includes('polish')) {
    console.log(`  AUDIT_ONLY — top task "${top.id}" should start with audit before implementation`)
  } else {
    console.log(`  AUDIT_ONLY — default until user explicitly authorizes implementation for "${top.id}"`)
  }
}

// ─── Hard boundary reminder ───────────────────────────────────────────────────

console.log('\nHard boundaries:')
console.log('  schema / payment / wallet / generate / env / production mutation')
console.log('  require explicit user approval every session.')
console.log('  Default mode is AUDIT_ONLY. Do not implement without authorization.')
console.log('  Do not push / deploy without user confirmation.')

// ─── Exit code ────────────────────────────────────────────────────────────────

if (!allOk) {
  console.log('\n[WARN] One or more required files are MISSING. Fix before starting work.\n')
  process.exitCode = 1
} else {
  console.log('\n[OK] All required files present.\n')
  process.exitCode = 0
}
