import { describe, expect, test } from 'bun:test'
import { buildEmail, isApplicationUpdate, linkPath, pickLang, type NotificationRow } from './templates.ts'

const base: NotificationRow = { id: 'n1', user_id: 'u1', type: 'application_status', title: 'Bilingual CSR', body: 'interview_scheduled', data: { job_id: 'j1' } }

describe('notification-email templates', () => {
  test('status body becomes a localized label', () => {
    expect(buildEmail(base, 'es', 'candidate', 'https://x.test').detail).toBe('Entrevista programada')
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
  test('unknown hq type uses the HQ subject', () => {
    expect(buildEmail({ ...base, type: 'hq_job_reported', title: 'Job reported: X' }, 'en', 'admin', 'https://x.test').subject).toBe('[HQ] Job reported: X')
  })
})
