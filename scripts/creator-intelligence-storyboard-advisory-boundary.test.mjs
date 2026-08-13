import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const files = [
  'apps/web/src/lib/storyboard/recipe/advisory.ts',
  'apps/web/src/lib/storyboard/recipe/intelligence.ts',
  'apps/web/src/lib/storyboard/recipe/state-machine.ts',
  'apps/web/src/components/create/StoryboardDirectorRecipePanel.tsx',
]
const forbiddenSegments = new Set([
  'billing',
  'credits',
  'payment',
  'prisma',
  'wallet',
  'cn-executor',
  'providers',
])
const forbiddenModules = new Set(['http', 'https', 'net', 'undici'])

function violatesImportBoundary(specifier) {
  const normalized = specifier.toLowerCase()
  return normalized.includes('/api/generate/')
    || forbiddenModules.has(normalized.replace(/^node:/, ''))
    || normalized.split(/[\\/]/).some((segment) => forbiddenSegments.has(segment))
}

function isFetchExpression(expression) {
  return (ts.isIdentifier(expression) && expression.text === 'fetch')
    || (ts.isPropertyAccessExpression(expression)
      && ts.isIdentifier(expression.expression)
      && expression.expression.text === 'globalThis'
      && expression.name.text === 'fetch')
}

function visit(node, callback) {
  callback(node)
  ts.forEachChild(node, (child) => visit(child, callback))
}

test('Storyboard advisory implementation remains local and dependency-bounded', async () => {
  for (const relativePath of files) {
    const path = `${repositoryRoot}/${relativePath}`
    const source = await readFile(path, 'utf8')
    const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)

    visit(sourceFile, (node) => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        && node.moduleSpecifier
        && ts.isStringLiteral(node.moduleSpecifier)) {
        assert.equal(
          violatesImportBoundary(node.moduleSpecifier.text),
          false,
          `${relativePath} must not import ${node.moduleSpecifier.text}`,
        )
      }
      if (ts.isCallExpression(node) && isFetchExpression(node.expression)) {
        assert.fail(`${relativePath} must not call fetch`)
      }
      if (ts.isIdentifier(node) && node.text === 'axios') {
        assert.fail(`${relativePath} must not reference axios`)
      }
      if (ts.isPropertyAccessExpression(node)
        && ts.isIdentifier(node.expression)
        && node.expression.text === 'process'
        && node.name.text === 'env') {
        assert.fail(`${relativePath} must not access process.env`)
      }
    })
  }
})
