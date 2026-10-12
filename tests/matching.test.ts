import { describe, expect, test } from 'bun:test'
import { matchReasons, displaySkill, MATCH_WEIGHTS, type MatchDetail } from '../src/lib/matchReasons'
import { cvSuggestions } from '../src/lib/cvSuggestions'
import type { CvExtracted } from '../src/types'

const t = (key: string, vars?: Record<string, string | number>) =>
  key + (vars ? ' ' + Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(',') : '')

const detail: MatchDetail = {
  score: 82, eligible: true, version: 'v1',
  components: { skills: 0.75, language: 1, experience: 1, salary: 1, location: 1, role: 0.5 },
  skills: { matched: ['sql', 'power bi', 'data analysis'], missing: ['python'], from_cv: ['data analysis'], total: 4 },
  languages: [{ lang: 'english', req: 4, has: 5, ok: true }, { lang: 'spanish', req: 6, has: 6, ok: true }],
  experience: { years: 4, band: 'mid', state: 'fits' },
  salary: 'fits', location: 'remote',
}

describe('match reasons', () => {
  test('weights add up to 100 (same as score_pair in 048)', () => {
    expect(MATCH_WEIGHTS.reduce((a, w) => a + w.weight, 0)).toBe(100)
  })
  test('plain reasons, missing skill in the job\'s own spelling, no line for native Spanish', () => {
    const r = matchReasons(detail, t, 'SQL, Power BI, Análisis de datos, Python')
    expect(r[0]).toBe('match.why.skills n=3,total=4')
    expect(r[1]).toBe('match.why.missing skills=Python')
    expect(r.some(l => l.includes('match.lang.spanish'))).toBe(false)
    expect(r).toContain('match.why.langOk lang=match.lang.english,has=C1,req=B2')
    expect(r).toContain('match.why.remote')
    expect(r).toContain('match.why.salaryFits')
    expect(r).toContain('match.why.expFits years=4')
  })
  test('a language gap is named', () => {
    const r = matchReasons({ ...detail, eligible: false, languages: [{ lang: 'english', req: 5, has: 3, ok: false }] }, t)
    expect(r).toContain('match.why.langGap lang=match.lang.english,has=B1,req=C1')
  })
  test('displaySkill falls back to a capitalized canonical name', () => {
    expect(displaySkill('customer service')).toBe('Customer service')
  })
})

describe('CV suggestions', () => {
  const x: CvExtracted = {
    skills: ['SQL', 'Power BI', 'Customer Service'], languages: [{ name: 'English', level: 'C1' }, { name: 'French', level: 'unknown' }],
    years_experience: 4.3, current_title: 'Analista de Riesgo', desired_role: null, seniority: 'mid',
    industries: [], education: [], summary: '',
  }
  test('only what the profile does not have yet', () => {
    const p = cvSuggestions(x, { skills: 'sql, Atención', languages: 'Inglés B2', years: '', role: '' })
    expect(p.skills).toEqual(['Power BI', 'Customer Service'])
    expect(p.languages).toEqual(['French'])
    expect(p.years).toBe(4)
    expect(p.role).toBe('Analista de Riesgo')
  })
  test('nothing new means no card', () => {
    expect(cvSuggestions(x, { skills: 'SQL, Power BI, customer service', languages: 'English C1, French', years: '5', role: 'Analyst' })).toEqual({})
  })
})
