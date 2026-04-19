import { db } from '@/lib/db'
import { sendEmail } from '@/lib/notifications/resend'
import { sendSms } from '@/lib/notifications/twilio'
import { renderTemplate, type NotificationEvent, type NotificationPayload } from '@/lib/notifications/templates'

export type { NotificationEvent, NotificationPayload }

export async function sendNotification(
  userId: string,
  event: NotificationEvent,
  payload: NotificationPayload
): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        phone: true,
        notificationPrefs: { select: { email: true, sms: true } },
      },
    })
    if (!user) return

    const prefs = user.notificationPrefs ?? { email: true, sms: false }
    if (!prefs.email && !(prefs.sms && user.phone)) return
    const { subject, emailBody, smsBody } = renderTemplate(event, payload)

    if (prefs.email) {
      try {
        await sendEmail(user.email, subject, emailBody)
      } catch (err) {
        console.error(`[notifications] sendEmail failed for ${userId} event=${event}:`, err)
      }
    }

    if (prefs.sms && user.phone) {
      try {
        await sendSms(user.phone, smsBody)
      } catch (err) {
        console.error(`[notifications] sendSms failed for ${userId} event=${event}:`, err)
      }
    }
  } catch (err) {
    console.error(`[notifications] sendNotification failed for ${userId} event=${event}:`, err)
  }
}
