import { describe, expect, test } from 'bun:test'
import { buildEmail, isApplicationUpdate, linkPath, pickLang, type NotificationRow } from './templates.ts'

const base: NotificationRow = { id: 'n1', user_id: 'u1', type: 'application_status', title: 'Bilingual CSR', body: 'interview_scheduled', data: { job_id: 'j1' } }

describe('notification-email templates', () => {
  test('status body becomes a plain stage and next step', () => {
    expect(buildEmail(base, 'es', 'candidate', 'https://x.test').detail).toBe('Entrevistas — Revisa tus mensajes y entrevistas para ver horarios y detalles.')
    expect(buildEmail({ ...base, body: 'submitted_to_client' }, 'en', 'candidate', 'https://x.test').detail).toBe('In review — The company is reviewing your profile. Nothing to do for now.')
    expect(buildEmail({ ...base, body: 'assessment_required' }, 'en', 'candidate', 'https://x.test').detail).toContain('assessment')
    expect(buildEmail({ ...base, body: 'not_selected' }, 'pt', 'candidate', 'https://x.test').detail).toBe('Não segue — Continue se candidatando: há vagas novas toda semana.')
    expect(buildEmail(base, 'en', 'candidate', 'https://x.test').subject).toBe('Update on your application: Bilingual CSR')
  })
  test('links follow the role', () => {
    expect(linkPath(base, 'candidate')).toBe('/candidate/applications')
    expect(linkPath({ ...base, type: 'application_received' }, 'employer')).toBe('/employer/manage/j1')
    expect(linkPath({ ...base, type: 'hq_new_lead' }, 'admin')).toBe('/hq')
    expect(linkPath({ ...base, type: 'payment_granted' }, 'employer')).toBe('/pricing')
  })
  test('html is escaped', () => {
    const e = buildEmail({ ...base, type: 'message_received', title: '<script>x</script>', body: 'a & b' }, 'en', 'employer', 'https://x.test/')
    expect(e.html).not.toContain('<script>')
    expect(e.html).toContain('a &amp; b')
    expect(e.url).toBe('https://x.test/employer/manage/j1')
  })
  test('opt-out scope and language fallback', () => {
    expect(isApplicationUpdate('offer_received')).toBe(true)
    expect(isApplicationUpdate('payment_granted')).toBe(false)
    expect(isApplicationUpdate('hq_new_lead')).toBe(false)
    expect(pickLang('pt')).toBe('pt')
    expect(pickLang(null)).toBe('es')
  })
  test('queued-job emails link to the job and to pricing', () => {
    expect(linkPath({ ...base, type: 'job_published' }, 'employer')).toBe('/employer/manage/j1')
    expect(linkPath({ ...base, type: 'job_needs_credits', data: {} }, 'employer')).toBe('/pricing')
    expect(buildEmail({ ...base, type: 'job_published', title: 'QA Lead' }, 'en', 'employer', 'https://x.test').subject).toBe('Your job is live: QA Lead')
  })
  test('unknown hq type uses the HQ subject', () => {
    expect(buildEmail({ ...base, type: 'hq_job_reported', title: 'X' }, 'en', 'admin', 'https://x.test').subject).toBe('[HQ] Job reported: X')
  })
})
