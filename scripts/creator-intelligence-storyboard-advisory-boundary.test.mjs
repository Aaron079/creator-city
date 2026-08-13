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
  'apps/web/src/components/create/StoryboardDirectorPanel.tsx',
]
const forbiddenSegments = new Set([
  'billing',
  'credits',
  'payment',
  'prisma',
  'wallet',
  'cn-executor',
  'crawler',
  'crawlers',
  'executor',
  'executors',
  'schema',
  'schemas',
  'external-model',
  'external-models',
  'model-adapter',
  'model-adapters',
  'provider',
  'providers',
  'byok',
])
const forbiddenModules = new Set(['http', 'https', 'net', 'undici'])
const forbiddenNetworkConstructors = new Set(['XMLHttpRequest', 'WebSocket'])

function violatesImportBoundary(specifier) {
  const normalized = specifier.toLowerCase()
  return normalized.includes('/api/generate/')
    || forbiddenModules.has(normalized.replace(/^node:/, ''))
    || normalized.split(/[\\/]/).some((segment) => forbiddenSegments.has(segment))
}

function creativeKnowledgeResolverIsAllowed(relativePath, specifier) {
  return relativePath === 'apps/web/src/lib/storyboard/recipe/advisory.ts'
    && specifier === '../../creative-knowledge/resolver'
}

function isFetchExpression(expression) {
  return (ts.isIdentifier(expression) && expression.text === 'fetch')
    || (ts.isPropertyAccessExpression(expression)
      && ts.isIdentifier(expression.expression)
      && ['globalThis', 'window', 'self'].includes(expression.expression.text)
      && expression.name.text === 'fetch')
}

function isForbiddenNetworkExpression(expression) {
  if (isFetchExpression(expression)) return true
  if (ts.isIdentifier(expression)) {
    return expression.text === 'axios' || forbiddenNetworkConstructors.has(expression.text)
  }
  if (!ts.isPropertyAccessExpression(expression) || !ts.isIdentifier(expression.expression)) {
    return false
  }
  if (expression.expression.text === 'navigator' && expression.name.text === 'sendBeacon') {
    return true
  }
  return ['globalThis', 'window', 'self'].includes(expression.expression.text)
    && forbiddenNetworkConstructors.has(expression.name.text)
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
        const specifier = node.moduleSpecifier.text
        assert.equal(
          violatesImportBoundary(specifier),
          false,
          `${relativePath} must not import ${specifier}`,
        )
        if (specifier.includes('creative-knowledge')) {
          assert.equal(
            creativeKnowledgeResolverIsAllowed(relativePath, specifier),
            true,
            `${relativePath} may not import creative knowledge directly`,
          )
        }
      }
      if ((ts.isCallExpression(node) || ts.isNewExpression(node))
        && isForbiddenNetworkExpression(node.expression)) {
        assert.fail(`${relativePath} must not use a network client`)
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
