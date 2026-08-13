import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const knowledgeDirectory = fileURLToPath(
  new URL('../apps/web/src/lib/creative-knowledge/', import.meta.url),
)
const skillsIndex = fileURLToPath(
  new URL('../apps/web/src/lib/skills/index.ts', import.meta.url),
)

const forbiddenImportSegments = new Set([
  'billing',
  'credits',
  'payment',
  'prisma',
  'wallet',
])

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

        return entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
          ? [path]
          : []
      }),
  )

  return files.flat().sort((left, right) => left.localeCompare(right))
}

function moduleSpecifierViolatesBoundary(specifier) {
  const normalizedSpecifier = specifier.toLowerCase()
  const segments = normalizedSpecifier.split(/[\\/]/)

  return (
    normalizedSpecifier.includes('/api/generate/') ||
    segments.some((segment) => forbiddenImportSegments.has(segment))
  )
}

function visitSourceFile(sourceFile, callback) {
  const visit = (node) => {
    callback(node)
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

test('creative knowledge production modules stay within static boundaries', async () => {
  const files = await listTypeScriptFiles(knowledgeDirectory)

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)

    visitSourceFile(sourceFile, (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        assert.equal(
          moduleSpecifierViolatesBoundary(node.moduleSpecifier.text),
          false,
          `${file.slice(repositoryRoot.length + 1)} must not import forbidden module ${node.moduleSpecifier.text}`,
        )
      }

      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'fetch'
      ) {
        assert.fail(`${file.slice(repositoryRoot.length + 1)} must not call fetch`)
      }

      if (ts.isIdentifier(node) && node.text === 'axios') {
        assert.fail(`${file.slice(repositoryRoot.length + 1)} must not reference axios`)
      }

      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'process' &&
        node.name.text === 'env'
      ) {
        assert.fail(`${file.slice(repositoryRoot.length + 1)} must not access process.env`)
      }
    })
  }
})

test('skills barrel re-exports creative knowledge', async () => {
  const source = await readFile(skillsIndex, 'utf8')
  const sourceFile = ts.createSourceFile(skillsIndex, source, ts.ScriptTarget.Latest, true)

  assert.ok(
    sourceFile.statements.some(
      (statement) =>
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === '../creative-knowledge',
    ),
  )
})
