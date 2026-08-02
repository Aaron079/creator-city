import { expect, test } from '@playwright/test'
import { getSafePreviewRegistrationFixture } from './support/canvas-e2e-safety'

test('Preview registration fixture fails closed without an explicit isolated write opt-in', () => {
  expect(getSafePreviewRegistrationFixture({}).ready).toBe(false)
})

test('Preview registration fixture rejects Production even when write flags are present', () => {
  expect(getSafePreviewRegistrationFixture({
    PLAYWRIGHT_BASE_URL: 'https://creator-city-vert.vercel.app',
    PLAYWRIGHT_SAFE_ENV: 'preview',
    PLAYWRIGHT_ALLOW_SAFE_WRITES: '1',
    PLAYWRIGHT_PREVIEW_E2E_REGISTER: '1',
    PLAYWRIGHT_SAFE_PREVIEW_HOST: 'creator-city-vert.vercel.app',
  }).ready).toBe(false)
})

test('Preview registration fixture accepts only a fully opted-in non-production target', () => {
  const fixture = getSafePreviewRegistrationFixture({
    PLAYWRIGHT_BASE_URL: 'https://preview.example.vercel.app',
    PLAYWRIGHT_SAFE_ENV: 'preview',
    PLAYWRIGHT_ALLOW_SAFE_WRITES: '1',
    PLAYWRIGHT_PREVIEW_E2E_REGISTER: '1',
    PLAYWRIGHT_SAFE_PREVIEW_HOST: 'preview.example.vercel.app',
  })

  expect(fixture.ready).toBe(true)
  if (fixture.ready) expect(fixture.baseUrl.origin).toBe('https://preview.example.vercel.app')
})

test('Preview registration fixture rejects an unpaired host', () => {
  expect(getSafePreviewRegistrationFixture({
    PLAYWRIGHT_BASE_URL: 'https://preview.example.vercel.app',
    PLAYWRIGHT_SAFE_ENV: 'preview',
    PLAYWRIGHT_ALLOW_SAFE_WRITES: '1',
    PLAYWRIGHT_PREVIEW_E2E_REGISTER: '1',
    PLAYWRIGHT_SAFE_PREVIEW_HOST: 'another-preview.example.vercel.app',
  }).ready).toBe(false)
})
