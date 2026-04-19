import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/notifications/resend', () => ({
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/notifications/twilio', () => ({
  sendSms: vi.fn(),
}))

import { db } from '@/lib/db'
import { sendEmail } from '@/lib/notifications/resend'
import { sendSms } from '@/lib/notifications/twilio'
import { sendNotification } from '@/lib/services/notifications'

const baseUser = {
  id: 'u1',
  email: 'tech@example.com',
  phone: '+15550001234',
}

beforeEach(() => vi.clearAllMocks())

describe('sendNotification', () => {
  it('sends email when email pref is true', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      notificationPrefs: { email: true, sms: false },
    } as any)
    await sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('sends sms when sms pref is true and phone is set', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      notificationPrefs: { email: false, sms: true },
    } as any)
    await sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })
    expect(sendEmail).not.toHaveBeenCalled()
    expect(sendSms).toHaveBeenCalledOnce()
  })

  it('sends both when both prefs are true', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      notificationPrefs: { email: true, sms: true },
    } as any)
    await sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(sendSms).toHaveBeenCalledOnce()
  })

  it('skips sms when sms pref is true but phone is null', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      phone: null,
      notificationPrefs: { email: false, sms: true },
    } as any)
    await sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('sends nothing when both prefs are false', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      notificationPrefs: { email: false, sms: false },
    } as any)
    await sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })
    expect(sendEmail).not.toHaveBeenCalled()
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('defaults to email-only when notificationPrefs is null', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      notificationPrefs: null,
    } as any)
    await sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('does not throw when user not found', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    await expect(sendNotification('missing', 'wo.assigned', { workOrderId: 'WO-1' })).resolves.toBeUndefined()
  })

  it('does not throw when sendEmail fails', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      notificationPrefs: { email: true, sms: false },
    } as any)
    vi.mocked(sendEmail).mockRejectedValue(new Error('Resend down'))
    await expect(sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })).resolves.toBeUndefined()
  })

  it('does not throw when sendSms fails', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      notificationPrefs: { email: false, sms: true },
    } as any)
    vi.mocked(sendSms).mockRejectedValue(new Error('Twilio down'))
    await expect(sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })).resolves.toBeUndefined()
  })
})
