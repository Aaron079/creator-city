import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const knowledgeDirectory = fileURLToPath(
  new URL('../apps/web/src/lib/creative-knowledge/', import.meta.url),
)
const skillsIndex = fileURLToPath(
  new URL('../apps/web/src/lib/skills/index.ts', import.meta.url),
)

const forbiddenSubstrings = [
  '/api/generate/',
  'fetch(',
  'axios',
  'prisma',
  'billing',
  'payment',
  'credits',
  'wallet',
  'process.env',
]

async function listTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const path = `${directory}/${entry.name}`

        if (entry.isDirectory()) {
          return listTypeScriptFiles(path)
        }

        return entry.isFile() && entry.name.endsWith('.ts') ? [path] : []
      }),
  )

  return files.flat().sort((left, right) => left.localeCompare(right))
}

test('creative knowledge modules stay within static boundaries', async () => {
  const files = await listTypeScriptFiles(knowledgeDirectory)

  for (const file of files) {
    const source = await readFile(file, 'utf8')

    for (const forbiddenSubstring of forbiddenSubstrings) {
      assert.equal(
        source.includes(forbiddenSubstring),
        false,
        `${file.slice(repositoryRoot.length + 1)} must not include ${forbiddenSubstring}`,
      )
    }
  }
})

test('skills barrel re-exports creative knowledge', async () => {
  const source = await readFile(skillsIndex, 'utf8')

  assert.ok(source.includes("export * from '../creative-knowledge'"))
})
