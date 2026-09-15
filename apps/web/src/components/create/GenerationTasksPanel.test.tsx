import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GenerationTasksPanel } from './GenerationTasksPanel'

Object.assign(globalThis, { React })

test('a previously failed task remains queryable without a generate action', () => {
  const html = renderToStaticMarkup(<GenerationTasksPanel open tasks={[{
    nodeId: 'video-1', nodeTitle: 'Video', kind: 'video', providerId: 'volcengine-seedance-video',
    model: 'configured-model', taskId: 'existing-task', status: 'error',
    errorMessage: 'generation_polling_timeout',
  }]} onClose={() => {}} onQueryTask={async () => {}} />)
  assert.match(html, />查询结果<\/button>/)
  assert.doesNotMatch(html, />重新生成<\/button>/)
})
