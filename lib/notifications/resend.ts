import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject,
    text: body,
  })
  if (error) {
    throw new Error(`Resend error: ${error.message}`)
  }
}

export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  body: string,
  attachment: { filename: string; content: Buffer }
): Promise<void> {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject,
    text: body,
    attachments: [{ filename: attachment.filename, content: attachment.content }],
  })
  if (error) {
    throw new Error(`Resend error: ${error.message}`)
  }
}
