import twilio from 'twilio'

export async function sendSms(to: string, body: string): Promise<void> {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  await client.messages.create({
    from: process.env.TWILIO_FROM_NUMBER!,
    to,
    body,
  })
}
