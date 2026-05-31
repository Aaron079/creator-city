/**
 * Unit tests for db-error.ts
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/db-error.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { isDbConnectionError } from './db-error'

describe('isDbConnectionError', () => {
  test('P2024 error code → true', () => {
    const err = Object.assign(new Error('Timed out fetching a new connection from the connection pool.'), { code: 'P2024' })
    assert.equal(isDbConnectionError(err), true)
  })

  test('P1001 error code → true', () => {
    const err = Object.assign(new Error('Can\'t reach database server.'), { code: 'P1001' })
    assert.equal(isDbConnectionError(err), true)
  })

  test('P1017 error code → true', () => {
    const err = Object.assign(new Error('Server has closed the connection.'), { code: 'P1017' })
    assert.equal(isDbConnectionError(err), true)
  })

  test('message "Timed out fetching a new connection" → true', () => {
    const err = new Error('Timed out fetching a new connection from the connection pool (timeout=10, connection limit=1).')
    assert.equal(isDbConnectionError(err), true)
  })

  test('message "too many clients" → true', () => {
    const err = new Error('too many clients already')
    assert.equal(isDbConnectionError(err), true)
  })

  test('message "connection pool" → true', () => {
    const err = new Error('Unable to start a transaction in the connection pool.')
    assert.equal(isDbConnectionError(err), true)
  })

  test('message "pgbouncer" → true', () => {
    const err = new Error('prepared statement "s1" already exists (pgbouncer transaction mode)')
    assert.equal(isDbConnectionError(err), true)
  })

  test('normal record-not-found error → false', () => {
    const err = new Error('Record not found.')
    assert.equal(isDbConnectionError(err), false)
  })

  test('InsufficientCredits-style error → false', () => {
    const err = new Error('Insufficient credits: required 5, available 2')
    assert.equal(isDbConnectionError(err), false)
  })

  test('non-Error string → false', () => {
    assert.equal(isDbConnectionError('some string'), false)
  })

  test('null → false', () => {
    assert.equal(isDbConnectionError(null), false)
  })

  test('number → false', () => {
    assert.equal(isDbConnectionError(404), false)
  })
})
