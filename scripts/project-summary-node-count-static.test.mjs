import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const route = readFileSync(
  new URL('../apps/web/src/app/api/projects/route.ts', import.meta.url),
  'utf8',
)

const ownedStart = route.indexOf("if (scope === 'owned')")
const ownedEnd = route.indexOf(
  '\n    const ownedProjects = await db.project.findMany',
  ownedStart,
)
const ownedBranch = route.slice(ownedStart, ownedEnd)

test('owned project summaries use one resilient batched node count query', () => {
  assert.match(
    route,
    /countProjectWorkflowNodes[\s\S]*toWorkflowNodeCountMap[\s\S]*from '@\/lib\/projects\/project-summary'/,
    'the route should import the project node count helpers',
  )
  assert.match(
    ownedBranch,
    /db\.canvasWorkflow\.findMany\([\s\S]*where:\s*{\s*id:\s*{\s*in:\s*workflowIds\s*}\s*}[\s\S]*_count:\s*{\s*select:\s*{\s*nodes:\s*true\s*}\s*}/,
    'workflow IDs should be counted in one batched query',
  )
  assert.match(
    ownedBranch,
    /node_count_query/,
    'the auxiliary count query should degrade with an explicit warning',
  )
  assert.match(
    ownedBranch,
    /nodeCount:\s*countProjectWorkflowNodes\(project\.canvasWorkflows,\s*workflowNodeCounts\)/,
    'each project should sum the counts for its workflows',
  )
  assert.doesNotMatch(
    ownedBranch,
    /nodeCount:\s*0/,
    'the owned-project normal path must not hardcode node counts to zero',
  )
})
