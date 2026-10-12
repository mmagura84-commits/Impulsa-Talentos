import { describe, expect, test } from 'bun:test'
import { scoreMatch } from '../src/lib/matchScore'
import type { Job, Profile } from '../src/types'

const job = { id: 'j1', title: 'Bilingual Data Analyst', skillsRequired: 'SQL, Power BI, Python', languagesRequired: 'English B2', level: 'Mid', locationType: 'Hybrid · Medellín' } as unknown as Job
const base = { id: 'p1', skills: ['SQL'], languages: 'English C1, Spanish Native', location: 'Medellín', experienceYears: 4 } as unknown as Profile

describe('matchScore uses the CV text', () => {
  test('skills named in the CV count as matches', () => {
    const without = scoreMatch(base, job)
    const withCv = scoreMatch({ ...base, parsedCvText: 'Analista de datos. Herramientas: Power BI, Python y Excel avanzado.' } as Profile, job)
    expect(without.skills).toBeLessThan(withCv.skills)
    expect(withCv.skills).toBe(50)
    expect(withCv.rationale.join(' ')).toContain('From your CV: Power BI, Python')
  })
  test('only whole words count (no "SQL" inside "NoSQLish")', () => {
    const p = { ...base, skills: [], parsedCvText: 'NoSQLish databases, PowerBIish dashboards' } as unknown as Profile
    expect(scoreMatch(p, job).skills).toBe(0)
  })
})
