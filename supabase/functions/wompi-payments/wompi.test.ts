import { describe, expect, test } from 'bun:test'
import { checkoutUrl, integritySignature, sha256Hex, verifyEvent, type WompiEvent } from './wompi.ts'

describe('wompi helpers', () => {
  test('integrity signature follows reference+amount+currency+secret', async () => {
    expect(await integritySignature('IT-1', 39000000, 'COP', 'sec')).toBe(await sha256Hex('IT-139000000COPsec'))
  })
  test('checkout url carries the signed fields', () => {
    const u = new URL(checkoutUrl({ publicKey: 'pub_test_x', reference: 'IT-1', amountInCents: 100, currency: 'COP', signature: 'abc', redirectUrl: 'https://s.test/pricing?payment=IT-1' }))
    expect(u.origin + u.pathname).toBe('https://checkout.wompi.co/p/')
    expect(u.searchParams.get('signature:integrity')).toBe('abc')
    expect(u.searchParams.get('redirect-url')).toBe('https://s.test/pricing?payment=IT-1')
  })
  test('event checksum: accepts genuine, rejects tampered or unsigned', async () => {
    const tx = { id: 'tx1', status: 'APPROVED', reference: 'IT-1', amount_in_cents: 39000000, currency: 'COP' }
    const props = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']
    const ts = 1730000000
    const checksum = await sha256Hex(`tx1APPROVED39000000${ts}evsec`)
    const ev: WompiEvent = { event: 'transaction.updated', data: { transaction: tx }, signature: { properties: props, checksum }, timestamp: ts }
    expect(await verifyEvent(ev, 'evsec')).toBe(true)
    expect(await verifyEvent({ ...ev, data: { transaction: { ...tx, amount_in_cents: 1 } } }, 'evsec')).toBe(false)
    expect(await verifyEvent(ev, 'other')).toBe(false)
    expect(await verifyEvent({ ...ev, signature: undefined }, 'evsec')).toBe(false)
    expect(await verifyEvent(ev, '')).toBe(false)
  })
})
