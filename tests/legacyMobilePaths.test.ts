import { describe, expect, test } from 'bun:test'
import { desktopPathFor } from '../src/lib/legacyMobilePaths'

describe('old /m links forward to the main pages', () => {
  test('known screens', () => {
    expect(desktopPathFor('/m')).toBe('/')
    expect(desktopPathFor('/m/')).toBe('/')
    expect(desktopPathFor('/m/home')).toBe('/dashboard')
    expect(desktopPathFor('/m/post')).toBe('/employer/post-job')
    expect(desktopPathFor('/m/applications')).toBe('/candidate/applications')
    expect(desktopPathFor('/m/saved/')).toBe('/candidate/saved')
  })
  test('detail pages keep their id', () => {
    expect(desktopPathFor('/m/jobs/abc')).toBe('/jobs/abc')
    expect(desktopPathFor('/m/companies/xyz')).toBe('/companies/xyz')
    expect(desktopPathFor('/m/edit-job/j1')).toBe('/employer/edit-job/j1')
  })
  test('anything else goes home, and /md is never touched', () => {
    expect(desktopPathFor('/m/unknown')).toBe('/')
    expect(desktopPathFor('/md')).toBe('/')
  })
})
