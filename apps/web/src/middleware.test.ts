import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'

const branchUrl = 'creator-city-git-codex-seedance-spatial-previs-p0-aarons-projects-e26427fd.vercel.app'

function withPreviewBranchUrl(run: () => void): void {
  const previous = process.env.VERCEL_BRANCH_URL
  const previousEnv = process.env.VERCEL_ENV
  process.env.VERCEL_BRANCH_URL = branchUrl
  process.env.VERCEL_ENV = 'preview'
  try {
    run()
  } finally {
    if (previous === undefined) delete process.env.VERCEL_BRANCH_URL
    else process.env.VERCEL_BRANCH_URL = previous
    if (previousEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = previousEnv
  }
}

test('redirects a commit-specific Preview URL to its stable branch URL', () => {
  withPreviewBranchUrl(() => {
    const response = middleware(new NextRequest(
      'https://creator-city-oa3gslihw-aarons-projects-e26427fd.vercel.app/create?projectId=project-1',
      { headers: { host: 'creator-city-oa3gslihw-aarons-projects-e26427fd.vercel.app' } },
    ))

    assert.equal(response.status, 307)
    assert.equal(
      response.headers.get('location'),
      `https://${branchUrl}/create?projectId=project-1`,
    )
  })
})

test('does not redirect the stable Preview branch URL again', () => {
  withPreviewBranchUrl(() => {
    const response = middleware(new NextRequest(
      `https://${branchUrl}/auth/login`,
      { headers: { host: branchUrl } },
    ))

    assert.equal(response.headers.get('location'), null)
  })
})

test('does not redirect the login API across Preview hosts', () => {
  withPreviewBranchUrl(() => {
    const response = middleware(new NextRequest(
      'https://creator-city-oa3gslihw-aarons-projects-e26427fd.vercel.app/api/auth/login',
      {
        method: 'POST',
        headers: { host: 'creator-city-oa3gslihw-aarons-projects-e26427fd.vercel.app' },
      },
    ))

    assert.equal(response.headers.get('location'), null)
  })
})

test('does not canonicalize a Production login page', () => {
  const previousEnv = process.env.VERCEL_ENV
  const previousBranchUrl = process.env.VERCEL_BRANCH_URL
  process.env.VERCEL_ENV = 'production'
  process.env.VERCEL_BRANCH_URL = branchUrl
  try {
    const response = middleware(new NextRequest(
      'https://creator-city.vercel.app/auth/login',
      { headers: { host: 'creator-city.vercel.app' } },
    ))

    assert.equal(response.headers.get('location'), null)
  } finally {
    if (previousEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = previousEnv
    if (previousBranchUrl === undefined) delete process.env.VERCEL_BRANCH_URL
    else process.env.VERCEL_BRANCH_URL = previousBranchUrl
  }
})
